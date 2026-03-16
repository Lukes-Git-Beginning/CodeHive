import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentInstance, AgentRun, ChatMessage } from '../types/agent'
import type { Project } from '../types/project'
import { useAgentStore } from '../stores/agentStore'
import { extractLearnings, getRelevantContext } from './knowledge'
import { useChatStore } from '../stores/chatStore'

// ── Types ──

type ModelTier = 'opus' | 'sonnet' | 'haiku'

interface TaskSpec {
  id: string
  name: string
  complexity: number // 1-10
  model: ModelTier
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

Antworte als JSON:
{
  "goals": ["Ziel 1", "Ziel 2"],
  "tasks": [{ "id": "task-01", "name": "...", "complexity": 5, "files": { "modify": [], "create": [], "read": [] }, "action": "...", "verify": "...", "done": "...", "dependsOn": [] }]
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
const agentCompletionCallbacks = new Map<string, () => void>()

function setupEventListeners() {
  // Returns a promise that resolves when listeners are set up
  return Promise.all([
    outputUnlisten
      ? Promise.resolve()
      : listen<{ agent_id: string; line: string }>('agent-output', (event) => {
          const { agent_id, line } = event.payload
          const agentStore = useAgentStore.getState()
          const chatStore = useChatStore.getState()

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
              const agent = agentStore.currentRun?.agents.find((a) => a.id === agent_id)
              chatStore.addMessage({
                id: crypto.randomUUID(),
                role: 'agent',
                agentRole: agent?.role,
                content: parsed.result,
                timestamp: new Date().toISOString(),
              })
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
            callback()
            agentCompletionCallbacks.delete(agent_id)
          }
        }).then((unlisten) => {
          statusUnlisten = unlisten
        }),
  ])
}

function waitForAgent(agentId: string): Promise<void> {
  return new Promise((resolve) => {
    agentCompletionCallbacks.set(agentId, resolve)
  })
}

// ── Spawn Helper ──

async function spawnAndWait(
  agentId: string,
  role: string,
  prompt: string,
  projectPath: string,
  systemPrompt: string,
  model: ModelTier = 'sonnet'
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

  await invoke('spawn_agent', {
    agentId,
    role,
    prompt,
    projectPath,
    systemPrompt,
    model: getModelFlag(model),
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

  // Inject knowledge base context
  const kbContext = await getRelevantContext(project)

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
    // Find JSON in output (might have extra text around it)
    const jsonMatch = output.match(/\{[\s\S]*"tasks"[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in planner output')

    const plan = JSON.parse(jsonMatch[0]) as { goals: string[]; tasks: TaskSpec[] }

    // Assign models based on complexity
    for (const task of plan.tasks) {
      task.model = getModelForComplexity(task.complexity)
      if (!task.dependsOn) task.dependsOn = []
    }

    const waves = buildWaves(plan.tasks)

    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'orchestrator',
      content: `Plan erstellt: ${plan.tasks.length} Tasks in ${waves.length} Wellen.\n${plan.tasks.map((t) => `  - [${t.model}] ${t.name} (Komplexität: ${t.complexity}/10)`).join('\n')}`,
      timestamp: new Date().toISOString(),
    })

    return { goals: plan.goals, tasks: plan.tasks, waves }
  } catch (err) {
    // Fallback: Create a single general task
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Plan-Parsing fehlgeschlagen, verwende Fallback-Modus. (${err})`,
      timestamp: new Date().toISOString(),
    })

    const fallbackTask: TaskSpec = {
      id: 'task-01',
      name: prompt.slice(0, 50),
      complexity: 7,
      model: 'sonnet',
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
        const taskPrompt = `Aufgabe: ${task.name}

${task.action}

Dateien zum Lesen: ${task.files.read.join(', ') || 'keine'}
Dateien zum Ändern: ${task.files.modify.join(', ') || 'keine'}
Neue Dateien: ${task.files.create.join(', ') || 'keine'}

Akzeptanzkriterium: ${task.done}
${task.verify ? `Verifikation: ${task.verify}` : ''}

Arbeite fokussiert und effizient. Ändere nur was nötig ist.`

        const systemPrompt = `Du bist ein Coding-Agent. Führe die Aufgabe präzise aus.
Ändere nur die Dateien die in der Aufgabe angegeben sind.
Wenn ein Verify-Befehl angegeben ist, führe ihn am Ende aus.
Sei effizient — keine unnötigen Änderungen.`

        try {
          await spawnAndWait(agentId, task.model === 'opus' ? 'architect' : 'backend', taskPrompt, project.path, systemPrompt, task.model)
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
    // Just show raw output if parsing fails
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

    // Phase 2: Execute in waves
    await executeWaves(plan, project)

    // Phase 3: Verify
    await verifyWork(plan, project)

    // Done
    // Extract learnings before finishing
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
  } finally {
    chatStore.setProcessing(false)
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
