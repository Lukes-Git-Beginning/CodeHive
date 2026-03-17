import { invoke } from '@tauri-apps/api/core'

interface KnowledgeEntry {
  id: string
  project_id: string
  key: string
  value: string
  source_agent: string
  created_at: string
}

/**
 * Search the knowledge base using FTS5 full-text search.
 * Returns up to `limit` relevant entries ranked by relevance.
 */
export async function searchKnowledge(
  projectId: string,
  query: string,
  limit = 5
): Promise<KnowledgeEntry[]> {
  try {
    // Sanitize query for FTS5: wrap individual words in quotes for safe matching
    const sanitized = query
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => `"${w.replace(/"/g, '')}"`)
      .join(' OR ')

    if (!sanitized) return []

    return await invoke<KnowledgeEntry[]>('db_search_knowledge', {
      projectId,
      query: sanitized,
      limit,
    })
  } catch {
    // FTS might fail on empty table or bad query — fall back to empty
    return []
  }
}

/**
 * Get all knowledge entries for a project (for UI display).
 */
export async function getAllKnowledge(projectId: string): Promise<KnowledgeEntry[]> {
  try {
    return await invoke<KnowledgeEntry[]>('db_get_knowledge', { projectId })
  } catch {
    return []
  }
}

/**
 * Delete a knowledge entry by ID.
 */
export async function deleteKnowledge(id: string): Promise<void> {
  await invoke('db_delete_knowledge', { id })
}

/**
 * Read CLAUDE.md from a project's root directory.
 */
export async function readClaudeMd(projectPath: string): Promise<string | null> {
  try {
    return await invoke<string | null>('read_claude_md', { path: projectPath })
  } catch {
    return null
  }
}

/**
 * Build enhanced context for agents by combining:
 * 1. CLAUDE.md instructions (if exists)
 * 2. FTS-matched knowledge from previous runs
 */
export async function getEnhancedContext(
  projectId: string,
  projectPath: string,
  prompt: string
): Promise<string> {
  const [claudeMd, searchResults] = await Promise.all([
    readClaudeMd(projectPath),
    searchKnowledge(projectId, prompt, 5),
  ])

  let context = ''

  if (claudeMd) {
    context += `\n--- CLAUDE.md Projektanweisungen ---\n${claudeMd.slice(0, 2000)}\n`
  }

  if (searchResults.length > 0) {
    const relevantKnowledge = searchResults
      .map((entry) => {
        // Try to parse JSON values for readable display
        try {
          const data = JSON.parse(entry.value)
          return `- [${entry.key}] ${data.prompt || data.summary || entry.value.slice(0, 200)}`
        } catch {
          return `- [${entry.key}] ${entry.value.slice(0, 200)}`
        }
      })
      .join('\n')

    context += `\n--- Relevantes Projektwissen ---\n${relevantKnowledge}\n`
  }

  return context
}
