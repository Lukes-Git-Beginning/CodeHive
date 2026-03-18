import { useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, CheckCircle, Loader2, Clock, Zap, Search, Shield, ChevronDown } from 'lucide-react'
import { useAgentStore } from '../../stores/agentStore'
import type { AgentInstance } from '../../types/agent'
import { StatusDot } from '../ui/StatusDot'

const DEFAULT_STATUS = { color: 'text-cyan', dotStatus: 'busy' as const, label: 'Active' }

const statusMap: Record<string, { color: string; dotStatus: 'online' | 'busy' | 'idle' | 'error'; label: string }> = {
  idle: { color: 'text-text-muted', dotStatus: 'idle', label: 'Idle' },
  thinking: { color: 'text-cyan', dotStatus: 'busy', label: 'Thinking' },
  working: { color: 'text-accent', dotStatus: 'online', label: 'Working' },
  running: { color: 'text-accent', dotStatus: 'online', label: 'Running' },
  done: { color: 'text-accent', dotStatus: 'online', label: 'Done' },
  error: { color: 'text-danger', dotStatus: 'error', label: 'Error' },
}

const roleColors: Record<string, string> = {
  orchestrator: 'text-cyan border-cyan/20 bg-cyan/8',
  frontend: 'text-[#60a5fa] border-[#60a5fa]/20 bg-[#60a5fa]/8',
  backend: 'text-accent border-accent/20 bg-accent/8',
  testing: 'text-violet border-violet/20 bg-violet/8',
  architect: 'text-warning border-warning/20 bg-warning/8',
  devops: 'text-cyan border-cyan/20 bg-cyan/8',
  security: 'text-danger border-danger/20 bg-danger/8',
  uiux: 'text-[#f472b6] border-[#f472b6]/20 bg-[#f472b6]/8',
}

const phaseLabels: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  idle: { label: 'Standby', icon: Clock, color: 'text-text-muted' },
  planning: { label: 'Planning', icon: Search, color: 'text-violet' },
  awaiting_approval: { label: 'Awaiting', icon: Clock, color: 'text-warning' },
  executing: { label: 'Executing', icon: Zap, color: 'text-accent' },
  verifying: { label: 'Verifying', icon: Shield, color: 'text-cyan' },
  done: { label: 'Complete', icon: CheckCircle, color: 'text-accent' },
}

function formatElapsed(startedAt: string, finishedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const seconds = Math.floor((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

const AgentCard = memo(function AgentCard({ agent }: { agent: AgentInstance }) {
  const [expanded, setExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(() => formatElapsed(agent.startedAt, agent.finishedAt))
  const status = statusMap[agent.status] || DEFAULT_STATUS
  const roleStyle = roleColors[agent.role] || 'text-text-secondary border-border bg-bg-surface'
  const isActive = agent.status === 'thinking' || agent.status === 'working'

  // Live elapsed time ticker for active agents
  useEffect(() => {
    if (!isActive) {
      setElapsed(formatElapsed(agent.startedAt, agent.finishedAt))
      return
    }
    const timer = setInterval(() => {
      setElapsed(formatElapsed(agent.startedAt))
    }, 1000)
    return () => clearInterval(timer)
  }, [isActive, agent.startedAt, agent.finishedAt])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-lg p-3 mb-2 transition-all ${isActive ? 'animate-border-pulse' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-hud px-2 py-0.5 rounded border ${roleStyle}`}>
          {agent.role}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-text-muted">{elapsed}</span>
          <StatusDot status={status.dotStatus} size={6} />
          <span className={`text-[10px] font-mono ${status.color}`}>{status.label}</span>
        </div>
      </div>

      {agent.currentTask && (
        <p className="text-[11px] text-text-secondary truncate mb-1.5">{agent.currentTask}</p>
      )}

      {agent.output.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary mb-1"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {agent.output.length} lines
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-bg-deep/50 rounded p-2 max-h-32 overflow-y-auto">
                  {agent.output.slice(-12).map((line, i) => (
                    <p key={i} className="text-[10px] text-text-muted font-mono truncate">{line}</p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
})

export function AgentMonitor() {
  const currentRun = useAgentStore((s) => s.currentRun)
  const runHistory = useAgentStore((s) => s.runHistory)
  const phase = useAgentStore((s) => s.phase)
  const currentWave = useAgentStore((s) => s.currentWave)
  const totalWaves = useAgentStore((s) => s.totalWaves)
  const phaseInfo = phaseLabels[phase] || phaseLabels.idle
  const PhaseIcon = phaseInfo.icon

  // Calculate progress percentage for the radial indicator
  const phases = ['planning', 'awaiting_approval', 'executing', 'verifying', 'done']
  const progressIdx = phases.indexOf(phase)
  const progress = phase === 'idle' ? 0 : ((progressIdx + 1) / phases.length) * 100

  return (
    <div className="h-full flex flex-col">
      {/* Phase Indicator */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          {/* Radial progress */}
          <div className="relative w-10 h-10 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r="15" fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress}, 100`}
                className={phaseInfo.color}
                animate={{ strokeDasharray: `${progress}, 100` }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <PhaseIcon className={`w-4 h-4 ${phaseInfo.color}`} />
            </div>
          </div>

          <div>
            <div className={`font-hud text-[10px] ${phaseInfo.color}`}>{phaseInfo.label}</div>
            {totalWaves > 0 && (
              <div className="text-[10px] text-text-muted font-mono">
                Wave {currentWave}/{totalWaves}
              </div>
            )}
          </div>
        </div>

        {/* Phase steps */}
        <div className="flex gap-1">
          {['Plan', 'Approve', 'Execute', 'Verify'].map((label, i) => {
            const completed = progressIdx > i
            const active = progressIdx === i
            return (
              <div key={label} className="flex-1">
                <div className={`h-1 rounded-full transition-all ${
                  completed ? 'bg-accent' : active ? 'bg-accent animate-pulse' : 'bg-white/5'
                }`} />
                <span className="text-[8px] text-text-muted block mt-1 text-center">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agents */}
      <div className="flex-1 overflow-y-auto p-3">
        {currentRun && currentRun.agents.length > 0 ? (
          currentRun.agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
        ) : currentRun ? (
          <div className="flex items-center gap-2 text-xs text-text-muted p-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            <span className="font-mono">Initializing agents...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Bot className="w-8 h-8 mb-2 opacity-15" />
            <p className="text-[11px] text-center font-mono">
              No active agents.<br />Start a task in chat.
            </p>
          </div>
        )}

        {/* History */}
        {runHistory.length > 0 && !currentRun && (
          <div className="mt-4 pt-4 border-t border-border">
            <span className="font-hud text-[9px] text-text-muted block mb-2">History</span>
            {runHistory.slice(0, 5).map((run) => (
              <div key={run.id} className="mb-1.5 p-2 glass rounded-lg text-[11px]">
                <div className="flex justify-between">
                  <span className="text-text-secondary truncate max-w-[70%]">{run.prompt}</span>
                  <span className="text-text-muted font-mono">{run.agents.length}x</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
