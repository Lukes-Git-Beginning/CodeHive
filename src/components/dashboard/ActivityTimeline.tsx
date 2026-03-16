import { motion } from 'framer-motion'
import { Cpu, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface AgentRun {
  id: string
  agent_type: string
  prompt: string
  status: string
  started_at: string
  finished_at: string | null
}

interface ActivityTimelineProps {
  runs: AgentRun[]
  loading: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string }> = {
  completed: { icon: CheckCircle, color: 'text-accent' },
  running: { icon: Clock, color: 'text-cyan' },
  done: { icon: CheckCircle, color: 'text-accent' },
  failed: { icon: AlertCircle, color: 'text-danger' },
  error: { icon: AlertCircle, color: 'text-danger' },
}

export function ActivityTimeline({ runs, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="glass rounded-xl p-4 h-full">
        <div className="font-hud text-[10px] text-violet mb-3">Activity</div>
        <p className="text-xs text-text-muted font-mono">Loading history...</p>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="font-hud text-[10px] text-violet">Activity</span>
        <span className="text-[10px] text-text-muted font-mono">{runs.length} runs</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Cpu className="w-6 h-6 mb-2 opacity-20" />
            <p className="text-[11px] font-mono">No activity yet.</p>
            <p className="text-[10px] mt-1">Start a task in the Chat tab.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />

            {runs.map((run, i) => {
              const config = statusConfig[run.status] || statusConfig.completed
              const Icon = config.icon
              return (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex gap-3 mb-3 relative"
                >
                  {/* Dot on timeline */}
                  <div className={`w-[23px] h-[23px] rounded-full glass flex items-center justify-center shrink-0 z-10`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-hud text-[9px] text-text-muted">{run.agent_type}</span>
                      <span className="text-[9px] text-text-muted font-mono">{timeAgo(run.started_at)}</span>
                    </div>
                    <p className="text-[11px] text-text-secondary truncate mt-0.5">{run.prompt}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
