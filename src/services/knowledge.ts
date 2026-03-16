import { invoke } from '@tauri-apps/api/core'
import type { Project } from '../types/project'
import type { AgentRun } from '../types/agent'

interface KnowledgeEntry {
  id: string
  project_id: string
  key: string
  value: string
  source_agent: string
  created_at: string
}

/**
 * Extract learnings from a completed agent run and store in the knowledge base
 */
export async function extractLearnings(run: AgentRun, project: Project): Promise<void> {
  if (!run.agents.length) return

  // Collect all agent outputs
  const outputs = run.agents
    .filter((a) => a.output.length > 0)
    .map((a) => `[${a.role}]: ${a.output.slice(-3).join(' ')}`)
    .join('\n')

  if (!outputs.trim()) return

  // Store a summary of what was done
  const entry: KnowledgeEntry = {
    id: crypto.randomUUID(),
    project_id: project.id,
    key: `run:${run.id}`,
    value: JSON.stringify({
      prompt: run.prompt,
      agentCount: run.agents.length,
      roles: run.agents.map((a) => a.role),
      status: run.status,
      summary: run.summary || '',
      filesChanged: run.agents.flatMap((a) => a.filesChanged),
    }),
    source_agent: 'orchestrator',
    created_at: new Date().toISOString(),
  }

  try {
    await invoke('db_save_knowledge', { entry })
  } catch (err) {
    console.error('Failed to save knowledge:', err)
  }
}

/**
 * Get relevant knowledge context for a project to inject into planner prompts
 */
export async function getRelevantContext(project: Project): Promise<string> {
  try {
    const entries = await invoke<KnowledgeEntry[]>('db_get_knowledge', {
      projectId: project.id,
    })

    if (entries.length === 0) return ''

    // Build context summary from recent knowledge
    const recent = entries.slice(0, 10)
    const summaries = recent
      .map((e) => {
        try {
          const data = JSON.parse(e.value)
          return `- ${data.prompt} (${data.roles?.join(', ')}) → ${data.status}`
        } catch {
          return `- ${e.key}: ${e.value.slice(0, 100)}`
        }
      })
      .join('\n')

    return `\n\nBisherige Arbeiten an diesem Projekt:\n${summaries}`
  } catch {
    return ''
  }
}
