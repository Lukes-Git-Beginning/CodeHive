import { create } from 'zustand'
import { loadAgentRuns } from '../services/persistence'
import { useProfileStore } from './profileStore'
import { useGitStore } from './gitStore'

interface MetricsData {
  successRate: number
  avgDuration: number
  healthScore: number
  tokenEstimate: number
  totalRuns: number
  completedRuns: number
  failedRuns: number
  taskTypeDistribution: Record<string, number>
  durationHistory: number[]
  dailyRunCounts: Record<string, number>
  loading: boolean
}

interface MetricsStore extends MetricsData {
  loadMetrics: (projectId: string) => Promise<void>
}

function computeHealthScore(
  successRate: number,
  lastRunTime: string | null,
  totalRuns: number,
  gitFiles: number,
  gitAhead: number,
): number {
  // 40% success rate
  const successComponent = successRate * 0.4

  // 30% recency
  let recency = 20
  if (lastRunTime) {
    const hoursAgo = (Date.now() - new Date(lastRunTime).getTime()) / 3_600_000
    if (hoursAgo < 1) recency = 100
    else if (hoursAgo < 24) recency = 80
    else if (hoursAgo < 168) recency = 50
  }
  const recencyComponent = recency * 0.3

  // 15% volume
  const volumeComponent = Math.min(totalRuns / 50, 1) * 100 * 0.15

  // 15% git cleanliness
  let gitHealth = 100
  if (gitFiles > 0) gitHealth = 50
  else if (gitAhead > 0) gitHealth = 70
  const gitComponent = gitHealth * 0.15

  return Math.round(Math.min(100, Math.max(0, successComponent + recencyComponent + volumeComponent + gitComponent)))
}

export const useMetricsStore = create<MetricsStore>((set) => ({
  successRate: 0,
  avgDuration: 0,
  healthScore: 0,
  tokenEstimate: 0,
  totalRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  taskTypeDistribution: {},
  durationHistory: [],
  dailyRunCounts: {},
  loading: false,

  loadMetrics: async (projectId: string) => {
    set({ loading: true })

    const [runs, profile, gitState] = await Promise.all([
      loadAgentRuns(projectId, 100),
      Promise.resolve(useProfileStore.getState().profile),
      Promise.resolve(useGitStore.getState()),
    ])

    // Success rate
    const total = profile.positiveRuns + profile.negativeRuns
    const successRate = total > 0 ? Math.round((profile.positiveRuns / total) * 100) : 0

    // Duration from DB runs
    const durations: number[] = []
    let tokenEst = 0
    const dailyCounts: Record<string, number> = {}
    let completed = 0
    let failed = 0
    let lastRunTime: string | null = null

    for (const run of runs) {
      // Duration
      if (run.started_at && run.finished_at) {
        const dur = (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
        if (dur > 0 && dur < 3600) durations.push(dur)
      }

      // Token estimate
      if (run.output) tokenEst += Math.ceil(run.output.length / 4)

      // Daily counts (last 14 days)
      if (run.started_at) {
        const day = run.started_at.slice(0, 10)
        dailyCounts[day] = (dailyCounts[day] || 0) + 1
        if (!lastRunTime || run.started_at > lastRunTime) lastRunTime = run.started_at
      }

      // Status
      if (run.status === 'completed') completed++
      else if (run.status === 'failed' || run.status === 'error') failed++
    }

    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0

    // Filter daily counts to last 14 days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const recentDailyCounts: Record<string, number> = {}
    for (const [day, count] of Object.entries(dailyCounts)) {
      if (day >= cutoffStr) recentDailyCounts[day] = count
    }

    const healthScore = computeHealthScore(
      successRate,
      lastRunTime,
      profile.totalRuns,
      gitState.status?.files.length ?? 0,
      gitState.status?.ahead ?? 0,
    )

    set({
      successRate,
      avgDuration,
      healthScore,
      tokenEstimate: tokenEst,
      totalRuns: profile.totalRuns,
      completedRuns: completed,
      failedRuns: failed,
      taskTypeDistribution: { ...profile.taskTypeFrequency },
      durationHistory: durations.slice(-20),
      dailyRunCounts: recentDailyCounts,
      loading: false,
    })
  },
}))
