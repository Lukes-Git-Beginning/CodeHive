/**
 * Blackboard Service — Shared communication layer between agents in a run.
 *
 * Agents post findings, warnings, requests, and artifacts to the blackboard.
 * The orchestrator injects blackboard state into agent prompts so agents in
 * later waves can build on earlier findings.
 *
 * Also detects file conflicts when multiple agents modify the same file.
 */

import type { BlackboardEntry, FileConflict, AgentInstance } from '../types/agent'

// ── In-Memory Blackboard (per-run, cleared on new orchestration) ──

let entries: BlackboardEntry[] = []
let conflicts: FileConflict[] = []
let currentRunId: string | null = null

/**
 * Initialize a fresh blackboard for a new orchestration run.
 */
export function initBlackboard(runId: string): void {
  entries = []
  conflicts = []
  currentRunId = runId
}

/**
 * Post an entry to the blackboard.
 */
export function postToBlackboard(entry: Omit<BlackboardEntry, 'id' | 'timestamp'>): void {
  entries.push({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  })
}

/**
 * Query entries by type or key pattern.
 */
export function queryBlackboard(
  filter?: { type?: BlackboardEntry['type']; waveIndex?: number; sourceRole?: string }
): BlackboardEntry[] {
  return entries.filter((e) => {
    if (filter?.type && e.type !== filter.type) return false
    if (filter?.waveIndex !== undefined && e.waveIndex !== filter.waveIndex) return false
    if (filter?.sourceRole && e.sourceRole !== filter.sourceRole) return false
    return true
  })
}

/**
 * Get all blackboard entries.
 */
export function getBlackboardEntries(): BlackboardEntry[] {
  return [...entries]
}

/**
 * Get all file conflicts.
 */
export function getFileConflicts(): FileConflict[] {
  return [...conflicts]
}

/**
 * Detect file conflicts after a wave completes.
 * Checks if multiple agents in the same wave modified the same file.
 */
export function detectConflicts(agents: AgentInstance[], waveIndex: number): FileConflict[] {
  const fileMap = new Map<string, { agentIds: string[]; agentRoles: string[] }>()

  for (const agent of agents) {
    if (agent.status === 'error') continue
    for (const file of agent.filesChanged) {
      const existing = fileMap.get(file)
      if (existing) {
        existing.agentIds.push(agent.id)
        existing.agentRoles.push(agent.role)
      } else {
        fileMap.set(file, { agentIds: [agent.id], agentRoles: [agent.role] })
      }
    }
  }

  const waveConflicts: FileConflict[] = []
  for (const [file, { agentIds, agentRoles }] of fileMap) {
    if (agentIds.length > 1) {
      const conflict: FileConflict = { file, agentIds, agentRoles, resolved: false }
      waveConflicts.push(conflict)
      conflicts.push(conflict)

      // Auto-post conflict as blackboard warning
      postToBlackboard({
        key: `conflict:${file}`,
        value: `Dateikonflikt: ${file} wurde von ${agentRoles.join(' + ')} gleichzeitig geändert`,
        type: 'conflict',
        sourceAgentId: 'orchestrator',
        sourceRole: 'orchestrator',
        waveIndex,
      })
    }
  }

  return waveConflicts
}

/**
 * Format blackboard state as context string for agent prompt injection.
 * Returns a compact summary suitable for LLM consumption.
 */
export function formatBlackboardForPrompt(maxEntries = 15): string {
  if (entries.length === 0) return ''

  const recent = entries.slice(-maxEntries)
  const lines = recent.map((e) => {
    const prefix = e.type === 'warning' ? '⚠️' :
                   e.type === 'conflict' ? '❌' :
                   e.type === 'request' ? '❓' :
                   e.type === 'artifact' ? '📦' : '📌'
    return `${prefix} [Wave ${e.waveIndex}, ${e.sourceRole}] ${e.key}: ${e.value}`
  })

  let result = '\n--- Blackboard (Shared Findings) ---\n'
  result += lines.join('\n')

  if (conflicts.length > 0) {
    const unresolved = conflicts.filter((c) => !c.resolved)
    if (unresolved.length > 0) {
      result += `\n\n⚠️ ${unresolved.length} ungelöste Dateikonflikte:`
      for (const c of unresolved) {
        result += `\n  - ${c.file} (${c.agentRoles.join(' vs ')})`
      }
    }
  }

  return result + '\n'
}

/**
 * Extract blackboard-relevant content from agent output.
 * Looks for structured markers like [FINDING], [WARNING], etc.
 */
export function extractAgentFindings(
  agentId: string,
  agentRole: string,
  output: string[],
  waveIndex: number
): void {
  const markers: Record<string, BlackboardEntry['type']> = {
    '[FINDING]': 'finding',
    '[WARNING]': 'warning',
    '[REQUEST]': 'request',
    '[ARTIFACT]': 'artifact',
  }

  for (const line of output) {
    for (const [marker, type] of Object.entries(markers)) {
      if (line.includes(marker)) {
        const content = line.replace(marker, '').trim()
        if (content) {
          postToBlackboard({
            key: `${agentRole}:${type}`,
            value: content,
            type,
            sourceAgentId: agentId,
            sourceRole: agentRole,
            waveIndex,
          })
        }
      }
    }
  }
}

/**
 * Get current run ID.
 */
export function getBlackboardRunId(): string | null {
  return currentRunId
}
