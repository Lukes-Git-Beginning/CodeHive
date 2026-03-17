import { create } from 'zustand'
import type { GitStatus, GitCommit } from '../types/git'
import { getGitStatus, getRecentCommits } from '../services/git'

interface GitStore {
  status: GitStatus | null
  commits: GitCommit[]
  isLoading: boolean
  pollingInterval: ReturnType<typeof setInterval> | null

  refresh: (projectPath: string) => Promise<void>
  startPolling: (projectPath: string) => void
  stopPolling: () => void
  clear: () => void
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: null,
  commits: [],
  isLoading: false,
  pollingInterval: null,

  refresh: async (projectPath: string) => {
    if (get().isLoading) return
    set({ isLoading: true })
    const [status, commits] = await Promise.all([
      getGitStatus(projectPath),
      getRecentCommits(projectPath, 10),
    ])
    set({ status, commits, isLoading: false })
  },

  startPolling: (projectPath: string) => {
    const { stopPolling, refresh } = get()
    stopPolling()
    refresh(projectPath)
    const interval = setInterval(() => refresh(projectPath), 15_000)
    set({ pollingInterval: interval })
  },

  stopPolling: () => {
    const { pollingInterval } = get()
    if (pollingInterval) {
      clearInterval(pollingInterval)
      set({ pollingInterval: null })
    }
  },

  clear: () => {
    get().stopPolling()
    set({ status: null, commits: [], isLoading: false })
  },
}))
