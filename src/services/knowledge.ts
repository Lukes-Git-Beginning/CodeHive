import { invoke } from '@tauri-apps/api/core'
import type { Project } from '../types/project'
import type { AgentRun } from '../types/agent'
import { getEnhancedContext } from './rag'

interface KnowledgeEntry {
  id: string
  project_id: string
  key: string
  value: string
  source_agent: string
  created_at: string
}

// ── Tier 1: Project Brief ──

/**
 * Get or create a project brief (high-level summary of tech stack, architecture, patterns)
 */
export async function getProjectBrief(project: Project): Promise<string> {
  try {
    const entries = await invoke<KnowledgeEntry[]>('db_get_knowledge', { projectId: project.id })
    const brief = entries.find((e) => e.key === 'project:brief')
    if (brief) return brief.value
  } catch { /* no brief yet */ }

  // Generate brief from available info
  const techInfo = project.techStack.length > 0
    ? `Tech-Stack: ${project.techStack.join(', ')}`
    : ''

  return `Projekt: ${project.name}\nPfad: ${project.path}\n${techInfo}`
}

/**
 * Update the project brief after a run
 */
export async function updateProjectBrief(project: Project, summary: string): Promise<void> {
  const entry: KnowledgeEntry = {
    id: `brief-${project.id}`,
    project_id: project.id,
    key: 'project:brief',
    value: summary,
    source_agent: 'orchestrator',
    created_at: new Date().toISOString(),
  }
  try {
    await invoke('db_save_knowledge', { entry })
  } catch (err) {
    console.error('Failed to save project brief:', err)
  }
}

// ── Tier 2: Recent Run History (last 10) ──

/**
 * Get recent run summaries for context injection
 */
export async function getRecentRunContext(project: Project): Promise<string> {
  try {
    const entries = await invoke<KnowledgeEntry[]>('db_get_knowledge', { projectId: project.id })
    const runs = entries
      .filter((e) => e.key.startsWith('run:'))
      .slice(0, 10)

    if (runs.length === 0) return ''

    const summaries = runs.map((e) => {
      try {
        const data = JSON.parse(e.value)
        const files = data.filesChanged?.length > 0 ? ` [${data.filesChanged.length} files]` : ''
        return `- ${data.prompt}${files} → ${data.status}`
      } catch {
        return null
      }
    }).filter(Boolean).join('\n')

    if (!summaries) return ''
    return `\nLetzte Aktivitäten:\n${summaries}`
  } catch {
    return ''
  }
}

// ── Combined Context (Tier 1 + 2 + RAG) ──

/**
 * Get all relevant context for the planner (combines all tiers + FTS search)
 */
export async function getRelevantContext(project: Project, prompt?: string): Promise<string> {
  const [brief, recentRuns, ragContext] = await Promise.all([
    getProjectBrief(project),
    getRecentRunContext(project),
    prompt ? getEnhancedContext(project.id, project.path, prompt) : Promise.resolve(''),
  ])

  let context = ''
  if (brief) context += `\n${brief}`
  if (recentRuns) context += `\n${recentRuns}`
  if (ragContext) context += `\n${ragContext}`
  return context
}

// ── Learning Extraction ──

/**
 * Extract learnings from a completed agent run and store in knowledge base
 */
export async function extractLearnings(run: AgentRun, project: Project): Promise<void> {
  if (!run.agents.length) return

  const outputs = run.agents
    .filter((a) => a.output.length > 0)
    .map((a) => `[${a.role}]: ${a.output.slice(-3).join(' ')}`)
    .join('\n')

  if (!outputs.trim()) return

  // Store run summary
  const runEntry: KnowledgeEntry = {
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
      timestamp: new Date().toISOString(),
    }),
    source_agent: 'orchestrator',
    created_at: new Date().toISOString(),
  }

  try {
    await invoke('db_save_knowledge', { entry: runEntry })
  } catch (err) {
    console.error('Failed to save run knowledge:', err)
  }

  // Extract and store learnings summary from agent outputs
  const learningsSummary = run.agents
    .filter((a) => a.status === 'done' && a.output.length > 0)
    .map((a) => {
      const lastOutput = a.output.slice(-5).join('\n')
      return `[${a.role}] ${lastOutput.slice(0, 500)}`
    })
    .join('\n---\n')

  if (learningsSummary.trim()) {
    const learningEntry: KnowledgeEntry = {
      id: crypto.randomUUID(),
      project_id: project.id,
      key: `learning:${run.id}`,
      value: JSON.stringify({
        prompt: run.prompt,
        learnings: learningsSummary.slice(0, 3000),
        roles: run.agents.map((a) => a.role),
        timestamp: new Date().toISOString(),
      }),
      source_agent: 'orchestrator',
      created_at: new Date().toISOString(),
    }

    try {
      await invoke('db_save_knowledge', { entry: learningEntry })
    } catch (err) {
      console.error('Failed to save learnings:', err)
    }
  }
}
