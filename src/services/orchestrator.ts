import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentInstance, AgentRun } from '../types/agent'
import type { Project } from '../types/project'
import { useAgentStore } from '../stores/agentStore'
import { extractLearnings, getRelevantContext, getProjectBrief } from './knowledge'
import { getSetting } from './persistence'
import { useChatStore } from '../stores/chatStore'
import { useNotificationStore } from '../stores/notificationStore'
import { ROLE_PROMPTS, getRoleForTask } from './agentRoles'
import { generateMcpConfig } from './mcpConfig'

// ── Types ──

type ModelTier = 'opus' | 'sonnet' | 'haiku'

interface TaskSpec {
  id: string
  name: string
  complexity: number // 1-10
  model: ModelTier
  role?: string
  files: {
    modify: string[]
    create: string[]
    read: string[]
  }
  action: string
  verify: string
  done: string
  dependsOn: string[]
}

interface ExecutionPlan {
  goals: string[]
  tasks: TaskSpec[]
  waves: TaskSpec[][] // Grouped by dependency order
}

// ── Model Routing ──

function getModelForComplexity(score: number): ModelTier {
  if (score <= 3) return 'haiku'
  if (score <= 7) return 'sonnet'
  return 'opus'
}

function getModelFlag(model: ModelTier): string {
  switch (model) {
    case 'opus': return 'claude-opus-4-6'
    case 'sonnet': return 'claude-sonnet-4-6'
    case 'haiku': return 'claude-haiku-4-5-20251001'
  }
}

// ── Wave Builder ──

function buildWaves(tasks: TaskSpec[]): TaskSpec[][] {
  const waves: TaskSpec[][] = []
  const completed = new Set<string>()
  let remaining = [...tasks]

  while (remaining.length > 0) {
    const wave = remaining.filter((t) =>
      t.dependsOn.every((dep) => completed.has(dep))
    )

    if (wave.length === 0) {
      // Circular dependency or missing dep — put all remaining in one wave
      waves.push(remaining)
      break
    }

    waves.push(wave)
    wave.forEach((t) => completed.add(t.id))
    remaining = remaining.filter((t) => !completed.has(t.id))
  }

  return waves
}

// ── Prompts ──

const PLANNER_SYSTEM_PROMPT = `Du bist ein Software-Projektmanager und Architekt mit 1M Context Window.
Du analysierst Aufgaben und zerlegst sie in atomare, ausführbare Tasks.

WICHTIG: Antworte NUR mit einem JSON-Objekt. Kein Markdown, keine Erklärungen davor oder danach.

Für jeden Task definierst du:
- id: Eindeutige ID (task-01, task-02, etc.)
- name: Kurzer beschreibender Name
- complexity: 1-10 (1=trivial, 10=sehr komplex)
- role: Die Spezialisierung des Agenten (frontend, backend, testing, devops, security, architect)
- files.modify: Dateien die geändert werden
- files.create: Neue Dateien
- files.read: Dateien die gelesen werden müssen
- action: Genaue Beschreibung was zu tun ist
- verify: Bash-Befehl der Erfolg beweist (z.B. Test-Run)
- done: Akzeptanzkriterium
- dependsOn: IDs von Tasks die vorher fertig sein müssen

Regeln:
- Jeder Task sollte von einem einzelnen Agenten in 5-15 min erledigt werden können
- Tasks ohne Abhängigkeiten können parallel laufen
- Nutze das Wissen über den Tech-Stack für passende verify-Befehle
- Wenn die Aufgabe einfach ist, erstelle nur 1-2 Tasks
- Bei komplexen Aufgaben: max 6-8 Tasks
- Wähle die passende Rolle: frontend für UI/React/CSS, backend für APIs/DB/Logik, testing für Tests, devops für CI/CD/Docker, security für Audits, architect für System-Design

Antworte als JSON:
{
  "goals": ["Ziel 1", "Ziel 2"],
  "tasks": [{ "id": "task-01", "name": "...", "complexity": 5, "role": "backend", "files": { "modify": [], "create": [], "read": [] }, "action": "...", "verify": "...", "done": "...", "dependsOn": [] }]
}`

const VERIFIER_SYSTEM_PROMPT = `Du bist ein Quality-Assurance-Spezialist mit 1M Context Window.
Du prüfst ob die Arbeit der Agenten die ursprünglichen Ziele erfüllt.

Prüfe goal-backward: "Was muss WAHR sein, damit die Ziele erreicht sind?"
Nicht: "Was wurde implementiert?"

Antworte als JSON:
{
  "passed": true/false,
  "results": [{ "goal": "...", "met": true/false, "evidence": "..." }],
  "gaps": ["Fehlende Sache 1", "..."],
  "summary": "Zusammenfassung"
}`

// ── Event Management ──

let outputUnlisten: (() => void) | null = null
let statusUnlisten: (() => void) | null = null
const agentCompletionCallbacks = new Map<string, (status: string) => void>()

const AGENT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes default

function setupEventListeners() {
  return Promise.all([
    outputUnlisten
      ? Promise.resolve()
      : listen<{ agent_id: string; line: string }>('agent-output', (event) => {
          const { agent_id, line } = event.payload
          const agentStore = useAgentStore.getState()

          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'assistant' && parsed.message?.content) {
              for (const block of parsed.message.content) {
                if (block.type === 'text') {
                  agentStore.appendAgentOutput(agent_id, block.text)
                }
              }
            } else if (parsed.type === 'result' && parsed.result) {
              agentStore.appendAgentOutput(agent_id, parsed.result)
            }
          } catch {
            if (line.trim() && !line.startsWith('[stderr]')) {
              agentStore.appendAgentOutput(agent_id, line)
            }
          }
        }).then((unlisten) => {
          outputUnlisten = unlisten
        }),

    statusUnlisten
      ? Promise.resolve()
      : listen<{ agent_id: string; status: string }>('agent-status', (event) => {
          const { agent_id, status } = event.payload
          const agentStore = useAgentStore.getState()

          agentStore.updateAgent(agent_id, {
            status: status as AgentInstance['status'],
            ...(status === 'done' || status === 'error'
              ? { finishedAt: new Date().toISOString() }
              : {}),
          })

          // Resolve completion promise for this agent
          const callback = agentCompletionCallbacks.get(agent_id)
          if (callback && (status === 'done' || status === 'error')) {
            callback(status)
            agentCompletionCallbacks.delete(agent_id)
          }
        }).then((unlisten) => {
          statusUnlisten = unlisten
        }),
  ])
}

function cleanupEventListeners() {
  outputUnlisten?.()
  statusUnlisten?.()
  outputUnlisten = null
  statusUnlisten = null
  // Clear any orphaned callbacks
  agentCompletionCallbacks.clear()
}

function waitForAgent(agentId: string, timeoutMs = AGENT_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      agentCompletionCallbacks.delete(agentId)
      const agentStore = useAgentStore.getState()
      agentStore.updateAgent(agentId, {
        status: 'error',
        finishedAt: new Date().toISOString(),
      })
      useNotificationStore.getState().addNotification(
        'error',
        `Agent ${agentId.slice(0, 8)} Timeout nach ${Math.round(timeoutMs / 1000)}s`
      )
      reject(new Error(`Agent ${agentId} timed out after ${timeoutMs / 1000}s`))
    }, timeoutMs)

    agentCompletionCallbacks.set(agentId, (status) => {
      clearTimeout(timer)
      resolve(status)
    })
  })
}

// ── Orchestration Lock ──

let orchestrationInProgress = false

// ── Spawn Helper ──

async function spawnAndWait(
  agentId: string,
  role: string,
  prompt: string,
  projectPath: string,
  systemPrompt: string,
  model: ModelTier = 'sonnet',
  mcpConfigPath?: string | null
): Promise<string> {
  const agentStore = useAgentStore.getState()

  agentStore.addAgent({
    id: agentId,
    role: role as AgentInstance['role'],
    status: 'working',
    currentTask: prompt.slice(0, 100) + '...',
    output: [],
    filesChanged: [],
    startedAt: new Date().toISOString(),
  })

  const completionPromise = waitForAgent(agentId)

  // Get permission mode from settings
  const autoAccept = await getSetting('auto_accept')
  const permissionMode = autoAccept === 'true' ? 'acceptEdits' : undefined

  await invoke('spawn_agent', {
    agentId,
    role,
    prompt,
    projectPath: projectPath.trim(),
    systemPrompt,
    model: getModelFlag(model),
    permissionMode,
    mcpConfigPath: mcpConfigPath || undefined,
  })

  await completionPromise

  // Collect output
  const agent = useAgentStore.getState().currentRun?.agents.find((a) => a.id === agentId)
  return agent?.output.join('\n') || ''
}

// ── Phase 1: Planning ──

async function planTask(prompt: string, project: Project): Promise<ExecutionPlan> {
  const chatStore = useChatStore.getState()
  const agentStore = useAgentStore.getState()
  agentStore.setPhase('planning')

  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'orchestrator',
    content: `Phase 1: Planung mit Opus 1M...\nAnalysiere Aufgabe und erstelle Task-Plan.`,
    timestamp: new Date().toISOString(),
  })

  // Inject knowledge base context (with FTS search using the user's prompt)
  const kbContext = await getRelevantContext(project, prompt)

  const plannerPrompt = `Projekt: ${project.name}
Pfad: ${project.path}
Tech-Stack: ${project.techStack.join(', ') || 'Unbekannt'}
${kbContext}

Aufgabe vom User: ${prompt}

Analysiere die Aufgabe und erstelle einen detaillierten Task-Plan als JSON.`

  const agentId = crypto.randomUUID()
  const output = await spawnAndWait(
    agentId,
    'orchestrator',
    plannerPrompt,
    project.path,
    PLANNER_SYSTEM_PROMPT,
    'opus'
  )

  // Parse the plan from output
  try {
    const jsonMatch = output.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in planner output')

    const plan = JSON.parse(jsonMatch[0]) as { goals: string[]; tasks: TaskSpec[] }

    // Assign models based on complexity, infer role if missing
    for (const task of plan.tasks) {
      task.model = getModelForComplexity(task.complexity)
      if (!task.dependsOn) task.dependsOn = []
      if (!task.role) task.role = getRoleForTask(task.action, task.name)
    }

    const waves = buildWaves(plan.tasks)

    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: `Plan erstellt: ${plan.tasks.length} Tasks in ${waves.length} Wellen.\n${plan.tasks.map((t) => `  - [${t.model}/${t.role || 'backend'}] ${t.name} (Komplexität: ${t.complexity}/10)`).join('\n')}`,
      timestamp: new Date().toISOString(),
    })

    return { goals: plan.goals, tasks: plan.tasks, waves }
  } catch (err) {
    // Graceful fallback — don't show raw JSON or error to user
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: `Aufgabe wird direkt ausgeführt...`,
      timestamp: new Date().toISOString(),
    })

    const fallbackTask: TaskSpec = {
      id: 'task-01',
      name: prompt.slice(0, 50),
      complexity: 7,
      model: 'sonnet',
      role: 'backend',
      files: { modify: [], create: [], read: [] },
      action: prompt,
      verify: '',
      done: 'Aufgabe abgeschlossen',
      dependsOn: [],
    }

    return {
      goals: [prompt],
      tasks: [fallbackTask],
      waves: [[fallbackTask]],
    }
  }
}

// ── Phase 2: Wave Execution ──

async function executeWaves(plan: ExecutionPlan, project: Project): Promise<void> {
  const chatStore = useChatStore.getState()
  const agentStore = useAgentStore.getState()
  agentStore.setPhase('executing')
  agentStore.setWaveInfo(0, plan.waves.length)

  // Get project context and MCP config for executor agents
  const brief = await getProjectBrief(project)
  const mcpConfigPath = await generateMcpConfig(project)

  for (let i = 0; i < plan.waves.length; i++) {
    useAgentStore.getState().setWaveInfo(i + 1, plan.waves.length)
    const wave = plan.waves[i]

    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: `Phase 2: Wave ${i + 1}/${plan.waves.length} — ${wave.length} Tasks parallel...`,
      timestamp: new Date().toISOString(),
    })

    // Execute all tasks in this wave in parallel
    await Promise.all(
      wave.map(async (task) => {
        const agentId = crypto.randomUUID()
        const role = task.role || getRoleForTask(task.action, task.name)
        const rolePrompt = ROLE_PROMPTS[role as keyof typeof ROLE_PROMPTS] || ROLE_PROMPTS.backend

        const taskPrompt = `Aufgabe: ${task.name}

${task.action}

Dateien zum Lesen: ${task.files.read.join(', ') || 'keine'}
Dateien zum Ändern: ${task.files.modify.join(', ') || 'keine'}
Neue Dateien: ${task.files.create.join(', ') || 'keine'}

Akzeptanzkriterium: ${task.done}
${task.verify ? `Verifikation: ${task.verify}` : ''}

Arbeite fokussiert und effizient. Ändere nur was nötig ist.`

        // Combine role-specific prompt with project context
        const systemPrompt = `${rolePrompt}

Projekt-Kontext:
${brief}
Tech-Stack: ${project.techStack.join(', ') || 'Unbekannt'}`

        try {
          await spawnAndWait(agentId, role, taskPrompt, project.path, systemPrompt, task.model, mcpConfigPath)
        } catch (err) {
          const agentStore = useAgentStore.getState()
          agentStore.updateAgent(agentId, { status: 'error' })
          agentStore.appendAgentOutput(agentId, `Fehler: ${err}`)
        }
      })
    )
  }
}

// ── Phase 3: Verification ──

async function verifyWork(plan: ExecutionPlan, project: Project): Promise<void> {
  const chatStore = useChatStore.getState()
  useAgentStore.getState().setPhase('verifying')

  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'orchestrator',
    content: `Phase 3: Verifikation mit Opus 1M...\nPrüfe ob Ziele erreicht wurden.`,
    timestamp: new Date().toISOString(),
  })

  const verifyPrompt = `Ursprüngliche Ziele:
${plan.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

Ausgeführte Tasks:
${plan.tasks.map((t) => `- ${t.name}: ${t.done}`).join('\n')}

Prüfe goal-backward: Sind alle Ziele erreicht? Was fehlt?`

  const agentId = crypto.randomUUID()
  const output = await spawnAndWait(
    agentId,
    'testing',
    verifyPrompt,
    project.path,
    VERIFIER_SYSTEM_PROMPT,
    'opus'
  )

  // Parse verification result
  try {
    const jsonMatch = output.match(/\{[\s\S]*"passed"[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      chatStore.addMessage({
        id: crypto.randomUUID(),
        role: 'orchestrator',
        content: result.passed
          ? `Verifikation bestanden! ${result.summary}`
          : `Verifikation: Lücken gefunden.\n${result.gaps?.join('\n') || result.summary}`,
        timestamp: new Date().toISOString(),
      })
    }
  } catch {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: `Verifikation abgeschlossen. Ergebnisse im Agent Monitor.`,
      timestamp: new Date().toISOString(),
    })
  }
}

// ── Main Orchestration ──

export async function orchestrate(prompt: string, project: Project): Promise<void> {
  // Prevent concurrent orchestrations
  if (orchestrationInProgress) {
    useNotificationStore.getState().addNotification(
      'warning',
      'Orchestrierung läuft bereits. Bitte warten.'
    )
    return
  }

  orchestrationInProgress = true
  const agentStore = useAgentStore.getState()
  const chatStore = useChatStore.getState()

  // Set up event listeners
  await setupEventListeners()

  // Create run
  const run: AgentRun = {
    id: crypto.randomUUID(),
    projectId: project.id,
    agents: [],
    prompt,
    status: 'running',
    startedAt: new Date().toISOString(),
  }
  agentStore.startRun(run)

  try {
    // Phase 1: Plan
    const plan = await planTask(prompt, project)

    // Plan Mode: Show plan and wait for approval
    const planModeEnabled = (await getSetting('plan_mode')) !== 'false'
    if (planModeEnabled && plan.tasks.length > 0) {
      await new Promise<void>((resolve) => {
        useAgentStore.getState().setPendingPlan(
          {
            goals: plan.goals,
            tasks: plan.tasks.map((t) => ({
              id: t.id,
              name: t.name,
              complexity: t.complexity,
              model: t.model,
              role: t.role,
            })),
            waveCount: plan.waves.length,
          },
          resolve
        )
      })

      // Check if plan was rejected
      if (useAgentStore.getState().phase === 'idle') {
        chatStore.setProcessing(false)
        return
      }
    }

    // Phase 2: Execute in waves
    await executeWaves(plan, project)

    // Phase 3: Verify
    await verifyWork(plan, project)

    // Done — extract learnings
    const finishedRun = useAgentStore.getState().currentRun
    if (finishedRun) {
      await extractLearnings(finishedRun, project)
    }

    agentStore.finishRun('Alle Phasen abgeschlossen: Plan → Execute → Verify')
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: 'Orchestrierung abgeschlossen. Alle 3 Phasen fertig.',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Orchestrierung fehlgeschlagen: ${err}`,
      timestamp: new Date().toISOString(),
    })
    agentStore.finishRun(`Fehler: ${err}`)
    useNotificationStore.getState().addNotification('error', `Orchestrierung fehlgeschlagen: ${err}`)
  } finally {
    chatStore.setProcessing(false)
    orchestrationInProgress = false
    cleanupEventListeners()
  }
}

// ── Direct Chat Mode (single agent, no orchestration overhead) ──

export async function directChat(prompt: string, project: Project): Promise<void> {
  if (orchestrationInProgress) {
    useNotificationStore.getState().addNotification(
      'warning',
      'Agent läuft bereits. Bitte warten.'
    )
    return
  }

  orchestrationInProgress = true
  const agentStore = useAgentStore.getState()
  const chatStore = useChatStore.getState()

  await setupEventListeners()

  const run: AgentRun = {
    id: crypto.randomUUID(),
    projectId: project.id,
    agents: [],
    prompt,
    status: 'running',
    startedAt: new Date().toISOString(),
  }
  agentStore.startRun(run)
  agentStore.setPhase('executing')

  try {
    const brief = await getProjectBrief(project)
    const mcpConfigPath = await generateMcpConfig(project)
    const agentId = crypto.randomUUID()

    const systemPrompt = `Du bist ein erfahrener Software-Entwickler. Arbeite direkt und effizient.

Projekt-Kontext:
${brief}
Tech-Stack: ${project.techStack.join(', ') || 'Unbekannt'}`

    await spawnAndWait(agentId, 'architect', prompt, project.path, systemPrompt, 'sonnet', mcpConfigPath)

    const finishedRun = useAgentStore.getState().currentRun
    if (finishedRun) {
      await extractLearnings(finishedRun, project)
    }

    agentStore.finishRun('Direct Chat abgeschlossen')
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: 'Agent fertig.',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Agent fehlgeschlagen: ${err}`,
      timestamp: new Date().toISOString(),
    })
    agentStore.finishRun(`Fehler: ${err}`)
  } finally {
    chatStore.setProcessing(false)
    orchestrationInProgress = false
    cleanupEventListeners()
  }
}

// ── Utilities ──

export async function checkClaudeCli(): Promise<string | null> {
  try {
    const version = await invoke<string>('check_claude_cli')
    return version.trim()
  } catch {
    return null
  }
}

export async function detectTechStack(path: string): Promise<string[]> {
  try {
    return await invoke<string[]>('detect_tech_stack', { path })
  } catch {
    return []
  }
}
