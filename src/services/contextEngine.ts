/**
 * Context Engineering Pipeline — Intelligent context assembly for agents.
 *
 * Instead of dumping everything into the prompt, this pipeline:
 * 1. Extracts task-relevant keywords
 * 2. Searches FTS5 for matching knowledge (reflections, learnings, runs)
 * 3. Filters by role relevance
 * 4. Budget-aware: keeps context under token limit (40% memory, 60% task)
 * 5. Prioritizes: reflections > recent runs > general knowledge
 *
 * This replaces the naive "inject everything" approach in knowledge.ts
 */

import { invoke } from '@tauri-apps/api/core'
import { searchKnowledge, readClaudeMd } from './rag'
import { useProfileStore } from '../stores/profileStore'
import type { AgentRun } from '../types/agent'
import type { Project } from '../types/project'

// Rough token estimate: ~4 chars per token
const CHARS_PER_TOKEN = 4
const MAX_CONTEXT_TOKENS = 8000 // ~32k chars for memory context
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN

/**
 * Build optimized agent context for a specific task and role.
 * Returns a formatted string ready for prompt injection.
 */
export async function buildAgentContext(
  task: { name: string; action: string; files: { read: string[]; modify: string[]; create: string[] } },
  _role: string,
  project: Project,
): Promise<string> {
  const budget = { used: 0, max: MAX_CONTEXT_CHARS }

  const sections: string[] = []

  // 1. CLAUDE.md (highest priority — always include)
  try {
    const claudeMd = await readClaudeMd(project.path)
    if (claudeMd) {
      const trimmed = claudeMd.slice(0, 2000)
      sections.push(`--- Projektanweisungen (CLAUDE.md) ---\n${trimmed}`)
      budget.used += trimmed.length
    }
  } catch { /* no CLAUDE.md */ }

  // 2. Reflections (learned patterns + anti-patterns from past runs)
  try {
    const keywords = extractKeywords(task.action + ' ' + task.name)
    const reflections = await searchKnowledge(project.id, `reflection ${keywords}`, 5)
    const relevantReflections = reflections
      .filter((e) => e.key.startsWith('reflection:'))
      .slice(0, 3)

    if (relevantReflections.length > 0) {
      const formatted = relevantReflections.map((e) => {
        try {
          const data = JSON.parse(e.value)
          const parts: string[] = []
          if (data.lesson) parts.push(`Erkenntnis: ${data.lesson}`)
          if (data.pattern) parts.push(`Pattern: ${data.pattern}`)
          if (data.antiPattern) parts.push(`Anti-Pattern: ${data.antiPattern}`)
          return parts.join(' | ')
        } catch {
          return e.value.slice(0, 200)
        }
      }).join('\n')

      if (budget.used + formatted.length < budget.max) {
        sections.push(`--- Gelernte Muster (aus vergangenen Runs) ---\n${formatted}`)
        budget.used += formatted.length
      }
    }
  } catch { /* search failed */ }

  // 3. Similar past runs (what worked before for similar tasks)
  try {
    const taskKeywords = extractKeywords(task.name)
    const pastRuns = await searchKnowledge(project.id, taskKeywords, 5)
    const runEntries = pastRuns
      .filter((e) => e.key.startsWith('run:'))
      .slice(0, 3)

    if (runEntries.length > 0) {
      const formatted = runEntries.map((e) => {
        try {
          const data = JSON.parse(e.value)
          return `- ${data.prompt?.slice(0, 80)} → ${data.status} (${data.agentCount} agents)`
        } catch {
          return null
        }
      }).filter(Boolean).join('\n')

      if (formatted && budget.used + formatted.length < budget.max) {
        sections.push(`--- Ähnliche vergangene Runs ---\n${formatted}`)
        budget.used += formatted.length
      }
    }
  } catch { /* search failed */ }

  // 4. User profile context
  const profileContext = useProfileStore.getState().getContextSummary()
  if (profileContext && budget.used + profileContext.length < budget.max) {
    sections.push(profileContext.trim())
    budget.used += profileContext.length
  }

  return sections.join('\n\n')
}

/**
 * Generate a reflective post-mortem for a completed run.
 * This creates structured knowledge that future runs can learn from.
 */
export async function generateReflection(
  run: AgentRun,
  project: Project,
): Promise<void> {
  if (!run.agents.length || run.status === 'rejected') return

  const success = run.status === 'completed'
  const agentSummaries = run.agents
    .filter((a) => a.output.length > 0)
    .map((a) => `[${a.role}] Status: ${a.status}, Output: ${a.output.slice(-3).join(' ').slice(0, 300)}`)
    .join('\n')

  if (!agentSummaries.trim()) return

  // Build reflection entry
  const reflection: Record<string, string> = {
    prompt: run.prompt.slice(0, 200),
    status: run.status,
    agentCount: String(run.agents.length),
    roles: run.agents.map((a) => a.role).join(', '),
    lesson: success
      ? `Erfolgreicher Run mit ${run.agents.length} Agents. Aufgabe: ${run.prompt.slice(0, 100)}`
      : `Fehlgeschlagener Run. Aufgabe: ${run.prompt.slice(0, 100)}`,
    timestamp: new Date().toISOString(),
  }

  // Extract patterns from successful agents
  if (success) {
    const filesChanged = run.agents.flatMap((a) => a.filesChanged)
    if (filesChanged.length > 0) {
      reflection.pattern = `Dateien geändert: ${filesChanged.slice(0, 10).join(', ')}`
    }
  }

  // Extract anti-patterns from failed agents
  const failedAgents = run.agents.filter((a) => a.status === 'error')
  if (failedAgents.length > 0) {
    reflection.antiPattern = failedAgents
      .map((a) => `${a.role} fehlgeschlagen: ${a.output.slice(-2).join(' ').slice(0, 150)}`)
      .join('; ')
  }

  // Store as knowledge entry
  const entry = {
    id: crypto.randomUUID(),
    project_id: project.id,
    key: `reflection:${run.id}`,
    value: JSON.stringify(reflection),
    source_agent: 'orchestrator',
    created_at: new Date().toISOString(),
  }

  try {
    await invoke('db_save_knowledge', { entry })
  } catch (err) {
    console.error('Failed to save reflection:', err)
  }
}

/**
 * Extract meaningful keywords from text for FTS5 search.
 */
function extractKeywords(text: string): string {
  const stopWords = new Set([
    'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'ist', 'sind', 'wird', 'werden',
    'auf', 'für', 'mit', 'von', 'den', 'dem', 'des', 'im', 'in', 'zu', 'am', 'an',
    'the', 'and', 'or', 'for', 'with', 'from', 'this', 'that', 'all', 'are', 'was',
    'nicht', 'nicht', 'auch', 'als', 'nach', 'bei', 'nur', 'noch', 'aber', 'wenn',
  ])

  return text
    .toLowerCase()
    .replace(/[^a-zA-ZäöüÄÖÜß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 8)
    .join(' ')
}
