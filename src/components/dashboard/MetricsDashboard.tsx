import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useProjectStore } from '../../stores/projectStore'
import { useMetricsStore } from '../../stores/metricsStore'
import { useChatStore } from '../../stores/chatStore'
import { MiniDonut } from './charts/MiniDonut'
import { MiniBar } from './charts/MiniBar'
import { Sparkline } from './charts/Sparkline'
import { FileExplorer } from './FileExplorer'
import { ActivityTimeline } from './ActivityTimeline'
import { QuickActions } from './QuickActions'
import { RefreshCw, Heart, TrendingUp, Clock, Zap } from 'lucide-react'

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

interface AgentRun {
  id: string
  agent_type: string
  prompt: string
  status: string
  started_at: string
  finished_at: string | null
}

const TASK_TYPE_COLORS: Record<string, string> = {
  security: 'var(--color-danger)',
  test: 'var(--color-violet)',
  feature: 'var(--color-accent)',
  bug: 'var(--color-warning)',
  refactor: 'var(--color-cyan)',
  review: 'var(--color-cyan)',
  deploy: 'var(--color-accent)',
  docs: 'var(--color-text-muted)',
  audit: 'var(--color-danger)',
}

function healthColor(score: number): string {
  if (score >= 70) return 'var(--color-accent)'
  if (score >= 40) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return `${min}m ${sec}s`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function DailyActivity({ dailyCounts }: { dailyCounts: Record<string, number> }) {
  // Build last 14 days
  const days: { label: string; count: number }[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({
      label: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      count: dailyCounts[key] || 0,
    })
  }
  const max = Math.max(...days.map((d) => d.count), 1)

  return (
    <div className="flex items-end gap-1 h-16">
      {days.map((day) => (
        <div key={day.label} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-sm transition-all duration-300"
            style={{
              height: `${Math.max((day.count / max) * 48, 2)}px`,
              backgroundColor: day.count > 0 ? 'var(--color-cyan)' : 'var(--color-bg-surface)',
            }}
            title={`${day.label}: ${day.count} Runs`}
          />
          {/* Show label every 3rd day */}
          {days.indexOf(day) % 3 === 0 && (
            <span className="text-[7px] text-text-muted font-mono">{day.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function MetricsDashboard() {
  const project = useProjectStore((s) => s.getActiveProject())
  const metrics = useMetricsStore((s) => ({
    successRate: s.successRate,
    avgDuration: s.avgDuration,
    healthScore: s.healthScore,
    tokenEstimate: s.tokenEstimate,
    totalRuns: s.totalRuns,
    completedRuns: s.completedRuns,
    failedRuns: s.failedRuns,
    taskTypeDistribution: s.taskTypeDistribution,
    durationHistory: s.durationHistory,
    dailyRunCounts: s.dailyRunCounts,
    loading: s.loading,
  }))
  const loadMetrics = useMetricsStore((s) => s.loadMetrics)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)

  useEffect(() => {
    if (!project) return

    loadMetrics(project.id)

    setLoadingFiles(true)
    invoke<FileEntry[]>('list_project_files', { path: project.path, maxDepth: 3 })
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoadingFiles(false))

    setLoadingRuns(true)
    invoke<AgentRun[]>('db_list_agent_runs', { projectId: project.id, limit: 20 })
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoadingRuns(false))
  }, [project?.id])

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted font-mono">Projekt auswählen.</p>
      </div>
    )
  }

  const handleQuickAction = (prompt: string) => {
    useChatStore.getState().addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    })
  }

  const taskTypeData = Object.entries(metrics.taskTypeDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({
      label,
      value,
      color: TASK_TYPE_COLORS[label] || 'var(--color-text-muted)',
    }))

  const hColor = healthColor(metrics.healthScore)
  const fileCount = files.reduce(function count(acc: number, e: FileEntry): number {
    return acc + (e.is_dir ? e.children.reduce(count, 0) : 1)
  }, 0)

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-hud text-sm text-accent text-glow-green">{project.name}</h2>
          <p className="text-[11px] text-text-muted font-mono mt-0.5">{project.path}</p>
        </div>
        <button
          onClick={() => loadMetrics(project.id)}
          className="p-2 rounded-lg hover:bg-bg-surface text-text-muted hover:text-accent transition-colors"
          title="Metriken aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 ${metrics.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metric Cards Row */}
      {metrics.loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-xl p-4 h-28 animate-pulse-glow" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {/* Health Score */}
          <div className="glass neon-hover rounded-xl p-3.5 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 self-start">
              <Heart className="w-3 h-3 text-text-muted" />
              <span className="font-hud text-[9px] text-text-muted">Systemgesundheit</span>
            </div>
            <MiniDonut value={metrics.healthScore} color={hColor} size={56} />
          </div>

          {/* Success Rate */}
          <div className="glass neon-hover rounded-xl p-3.5 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 self-start">
              <TrendingUp className="w-3 h-3 text-text-muted" />
              <span className="font-hud text-[9px] text-text-muted">Erfolgsrate</span>
            </div>
            <MiniDonut value={metrics.successRate} color="var(--color-accent)" size={56} />
            <span className="text-[9px] text-text-muted font-mono">
              {metrics.completedRuns}/{metrics.completedRuns + metrics.failedRuns} Runs
            </span>
          </div>

          {/* Avg Duration */}
          <div className="glass neon-hover rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-text-muted" />
              <span className="font-hud text-[9px] text-text-muted">Avg. Dauer</span>
            </div>
            <span className="text-lg font-mono text-cyan">{formatDuration(metrics.avgDuration)}</span>
            <Sparkline data={metrics.durationHistory} color="var(--color-cyan)" width={140} height={28} />
          </div>

          {/* Token Usage */}
          <div className="glass neon-hover rounded-xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-text-muted" />
              <span className="font-hud text-[9px] text-text-muted">~Token-Verbrauch</span>
            </div>
            <span className="text-lg font-mono text-violet">~{formatTokens(metrics.tokenEstimate)}</span>
            <div className="flex items-center gap-2 mt-auto">
              <span className="text-[9px] text-text-muted font-mono">{metrics.totalRuns} Runs gesamt</span>
              <span className="text-[9px] text-text-muted font-mono">{fileCount} Dateien</span>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Row */}
      <div className="grid grid-cols-5 gap-3">
        {/* Task Distribution */}
        <div className="col-span-3 glass rounded-xl p-3.5">
          <span className="font-hud text-[9px] text-text-muted block mb-3">Aufgabenverteilung</span>
          {taskTypeData.length > 0 ? (
            <MiniBar data={taskTypeData} />
          ) : (
            <p className="text-[10px] text-text-muted font-mono">Noch keine Daten</p>
          )}
        </div>

        {/* Daily Activity */}
        <div className="col-span-2 glass rounded-xl p-3.5">
          <span className="font-hud text-[9px] text-text-muted block mb-3">Aktivität (14 Tage)</span>
          <DailyActivity dailyCounts={metrics.dailyRunCounts} />
        </div>
      </div>

      {/* Main Grid: Files + Activity (preserved from original) */}
      <div className="grid grid-cols-5 gap-3" style={{ minHeight: '250px' }}>
        <div className="col-span-2">
          <FileExplorer files={files} loading={loadingFiles} />
        </div>
        <div className="col-span-3">
          <ActivityTimeline runs={runs} loading={loadingRuns} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions onAction={handleQuickAction} />
    </div>
  )
}
