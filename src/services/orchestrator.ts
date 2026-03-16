import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AgentRole, AgentInstance, AgentRun, ChatMessage } from '../types/agent'
import type { Project } from '../types/project'
import { useAgentStore } from '../stores/agentStore'
import { useChatStore } from '../stores/chatStore'

interface AgentTemplate {
  role: AgentRole
  label: string
  systemPrompt: string
  triggerKeywords: string[]
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    role: 'frontend',
    label: 'Frontend',
    systemPrompt: `Du bist ein Frontend-Spezialist. Fokus: React, Vue, HTML, CSS, Tailwind, UI-Komponenten, responsives Design, Accessibility. Schreibe sauberen, modernen Frontend-Code. Nutze bestehende Patterns und Komponenten des Projekts.`,
    triggerKeywords: ['ui', 'frontend', 'css', 'tailwind', 'button', 'form', 'layout', 'component', 'design', 'style', 'responsive', 'template', 'html', 'seite', 'page', 'anzeige', 'darstellung'],
  },
  {
    role: 'backend',
    label: 'Backend',
    systemPrompt: `Du bist ein Backend-Spezialist. Fokus: APIs, Datenbank, Server-Logik, Services, Authentication, Business Logic. Schreibe robuste, sichere Backend-Services. Nutze bestehende Service-Layer und Patterns.`,
    triggerKeywords: ['api', 'backend', 'database', 'datenbank', 'server', 'route', 'endpoint', 'service', 'model', 'migration', 'query', 'auth', 'login', 'session'],
  },
  {
    role: 'testing',
    label: 'Testing',
    systemPrompt: `Du bist ein Testing-Spezialist. Fokus: Unit Tests, Integration Tests, E2E Tests. Schreibe umfassende Tests die Edge-Cases abdecken. Nutze bestehende Test-Fixtures und Patterns.`,
    triggerKeywords: ['test', 'testing', 'unittest', 'pytest', 'jest', 'bug', 'fehler', 'fix', 'broken', 'kaputt', 'funktioniert nicht'],
  },
  {
    role: 'architect',
    label: 'Architect',
    systemPrompt: `Du bist ein Software-Architekt. Fokus: Projekt-Struktur, Architektur-Entscheidungen, Code-Organisation, Refactoring, Performance. Analysiere das Gesamtbild und schlage strukturelle Verbesserungen vor.`,
    triggerKeywords: ['architektur', 'structure', 'refactor', 'reorganize', 'performance', 'optimier', 'design pattern', 'migration'],
  },
  {
    role: 'devops',
    label: 'DevOps',
    systemPrompt: `Du bist ein DevOps-Spezialist. Fokus: Deployment, CI/CD, Docker, Server-Konfiguration, Monitoring. Automatisiere und optimiere den Deployment-Prozess.`,
    triggerKeywords: ['deploy', 'docker', 'ci', 'cd', 'pipeline', 'server', 'production', 'build', 'release'],
  },
  {
    role: 'security',
    label: 'Security',
    systemPrompt: `Du bist ein Security-Spezialist. Fokus: Sicherheits-Audits, Vulnerability-Scanning, Auth-Systeme, Input-Validation, CSRF, XSS, SQL-Injection. Finde und behebe Sicherheitslücken.`,
    triggerKeywords: ['security', 'sicherheit', 'vulnerability', 'csrf', 'xss', 'injection', 'auth', 'password', 'encrypt', 'token'],
  },
]

/**
 * Analyze a prompt and determine which agent roles are needed
 */
function analyzePrompt(prompt: string): AgentRole[] {
  const lower = prompt.toLowerCase()
  const matchedRoles: { role: AgentRole; score: number }[] = []

  for (const template of AGENT_TEMPLATES) {
    const score = template.triggerKeywords.reduce((acc, kw) => {
      return acc + (lower.includes(kw) ? 1 : 0)
    }, 0)

    if (score > 0) {
      matchedRoles.push({ role: template.role, score })
    }
  }

  // Sort by score descending, take top matches
  matchedRoles.sort((a, b) => b.score - a.score)

  // If no matches, default to architect (general analysis)
  if (matchedRoles.length === 0) {
    return ['architect']
  }

  return matchedRoles.map((m) => m.role)
}

function getTemplate(role: AgentRole): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.role === role)
}

/**
 * Build the full prompt for a specialist agent
 */
function buildAgentPrompt(role: AgentRole, userPrompt: string, project: Project): string {
  const techInfo = project.techStack.length > 0
    ? `Tech-Stack: ${project.techStack.join(', ')}`
    : ''

  return `Projekt: ${project.name}
Pfad: ${project.path}
${techInfo}

Aufgabe: ${userPrompt}

Arbeite fokussiert an deinem Spezialgebiet. Sei präzise und effizient.`
}

// Track active event listeners for cleanup
let outputUnlisten: (() => void) | null = null
let statusUnlisten: (() => void) | null = null

/**
 * Main orchestration function - analyzes the task and spawns agents
 */
export async function orchestrate(prompt: string, project: Project): Promise<void> {
  const agentStore = useAgentStore.getState()
  const chatStore = useChatStore.getState()

  // Step 1: Analyze what agents we need
  const neededRoles = analyzePrompt(prompt)

  // Notify user what we're doing
  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'orchestrator',
    content: `Aufgabe analysiert. Spawne ${neededRoles.length} Agenten: ${neededRoles
      .map((r) => getTemplate(r)?.label || r)
      .join(', ')}`,
    timestamp: new Date().toISOString(),
  })

  // Step 2: Create a run
  const run: AgentRun = {
    id: crypto.randomUUID(),
    projectId: project.id,
    agents: [],
    prompt,
    status: 'running',
    startedAt: new Date().toISOString(),
  }
  agentStore.startRun(run)

  // Step 3: Set up event listeners for agent output
  if (outputUnlisten) outputUnlisten()
  if (statusUnlisten) statusUnlisten()

  outputUnlisten = await listen<{ agent_id: string; line: string }>('agent-output', (event) => {
    const { agent_id, line } = event.payload

    // Try to parse stream-json output
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

        // Post result as chat message
        const agent = useAgentStore.getState().currentRun?.agents.find((a) => a.id === agent_id)
        chatStore.addMessage({
          id: crypto.randomUUID(),
          role: 'agent',
          agentRole: agent?.role,
          content: parsed.result,
          timestamp: new Date().toISOString(),
        })
      }
    } catch {
      // Not JSON, just append raw line
      if (line.trim() && !line.startsWith('[stderr]')) {
        agentStore.appendAgentOutput(agent_id, line)
      }
    }
  })

  statusUnlisten = await listen<{ agent_id: string; status: string }>('agent-status', (event) => {
    const { agent_id, status } = event.payload
    agentStore.updateAgent(agent_id, {
      status: status as AgentInstance['status'],
      ...(status === 'done' || status === 'error'
        ? { finishedAt: new Date().toISOString() }
        : {}),
    })

    // Check if all agents are done
    const currentRun = useAgentStore.getState().currentRun
    if (currentRun) {
      const allDone = currentRun.agents.every(
        (a) => a.status === 'done' || a.status === 'error'
      )
      if (allDone) {
        agentStore.finishRun('Alle Agenten haben ihre Arbeit abgeschlossen.')
        chatStore.addMessage({
          id: crypto.randomUUID(),
          role: 'orchestrator',
          content: 'Alle Agenten sind fertig. Die Ergebnisse findest du oben.',
          timestamp: new Date().toISOString(),
        })
        chatStore.setProcessing(false)
      }
    }
  })

  // Step 4: Spawn each agent
  for (const role of neededRoles) {
    const template = getTemplate(role)
    if (!template) continue

    const agentId = crypto.randomUUID()
    const agentPrompt = buildAgentPrompt(role, prompt, project)

    // Add agent to run
    const agentInstance: AgentInstance = {
      id: agentId,
      role,
      status: 'thinking',
      currentTask: prompt,
      output: [],
      filesChanged: [],
      startedAt: new Date().toISOString(),
    }
    agentStore.addAgent(agentInstance)

    // Spawn via Tauri command
    try {
      await invoke('spawn_agent', {
        agentId,
        role,
        prompt: agentPrompt,
        projectPath: project.path,
        systemPrompt: template.systemPrompt,
      })
    } catch (err) {
      agentStore.updateAgent(agentId, {
        status: 'error',
        finishedAt: new Date().toISOString(),
      })
      agentStore.appendAgentOutput(agentId, `Fehler: ${err}`)
    }
  }
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeCli(): Promise<string | null> {
  try {
    const version = await invoke<string>('check_claude_cli')
    return version.trim()
  } catch {
    return null
  }
}

/**
 * Detect tech stack of a project path
 */
export async function detectTechStack(path: string): Promise<string[]> {
  try {
    return await invoke<string[]>('detect_tech_stack', { path })
  } catch {
    return []
  }
}
