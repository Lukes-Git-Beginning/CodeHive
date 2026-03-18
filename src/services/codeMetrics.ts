import { invoke } from '@tauri-apps/api/core'

export interface CodeMetrics {
  totalFiles: number
  largestFiles: { path: string; size: number }[]
  recentlyChanged: string[]
  todoCount: number
}

export async function gatherMetrics(projectPath: string): Promise<CodeMetrics> {
  try {
    // Get recently changed files from git log
    let recentlyChanged: string[] = []
    try {
      const commits: Array<{ files?: string[] }> = await invoke('git_log', { path: projectPath }) ?? []
      const changedFiles = new Set<string>()
      for (const commit of commits.slice(0, 5)) {
        for (const f of commit.files || []) {
          changedFiles.add(f)
        }
      }
      recentlyChanged = [...changedFiles].slice(0, 20)
    } catch {
      // git not available or not a git repo
    }

    // Get file list
    let totalFiles = 0
    try {
      const files: string[] = await invoke('list_project_files', { path: projectPath })
      totalFiles = files.filter(f => /\.(tsx?|rs|css|json)$/.test(f)).length
    } catch {
      // fallback
    }

    return {
      totalFiles,
      largestFiles: [], // Would need file size info from backend
      recentlyChanged,
      todoCount: 0, // Would need grep functionality
    }
  } catch (err) {
    console.error('Metrics gathering failed:', err)
    return { totalFiles: 0, largestFiles: [], recentlyChanged: [], todoCount: 0 }
  }
}
