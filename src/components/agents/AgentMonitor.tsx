import { Bot, CheckCircle, AlertCircle, Loader2, Clock, FileCode, Zap, Search, Shield } from 'lucide-react'
import { useAgentStore } from '../../stores/agentStore'
import type { AgentInstance, AgentStatus } from '../../types/agent'

const statusConfig: Record<AgentStatus, { icon: typeof Bot; color: string; label: string }> = {
  idle: { icon: Clock, color: 'text-text-muted', label: 'Bereit' },
  thinking: { icon: Loader2, color: 'text-blue-400', label: 'Denkt...' },
  working: { icon: Loader2, color: 'text-accent', label: 'Arbeitet...' },
  done: { icon: CheckCircle, color: 'text-success', label: 'Fertig' },
  error: { icon: AlertCircle, color: 'text-error', label: 'Fehler' },
}

const roleConfig: Record<string, { label: string; color: string }> = {
  orchestrator: { label: 'Orchestrator', color: 'bg-amber-500/20 text-amber-400' },
  frontend: { label: 'Frontend', color: 'bg-blue-500/20 text-blue-400' },
  backend: { label: 'Backend', color: 'bg-green-500/20 text-green-400' },
  testing: { label: 'Testing', color: 'bg-purple-500/20 text-purple-400' },
  architect: { label: 'Architect', color: 'bg-orange-500/20 text-orange-400' },
  devops: { label: 'DevOps', color: 'bg-cyan-500/20 text-cyan-400' },
  security: { label: 'Security', color: 'bg-red-500/20 text-red-400' },
  uiux: { label: 'UI/UX', color: 'bg-pink-500/20 text-pink-400' },
}

const phaseConfig = {
  idle: { label: 'Bereit', icon: Clock, color: 'text-text-muted' },
  planning: { label: 'Planung (Opus 1M)', icon: Search, color: 'text-blue-400' },
  executing: { label: 'Ausführung', icon: Zap, color: 'text-accent' },
  verifying: { label: 'Verifikation (Opus 1M)', icon: Shield, color: 'text-purple-400' },
  done: { label: 'Abgeschlossen', icon: CheckCircle, color: 'text-success' },
}

function AgentCard({ agent }: { agent: AgentInstance }) {
  const config = statusConfig[agent.status]
  const Icon = config.icon
  const role = roleConfig[agent.role] || { label: agent.role, color: 'bg-gray-500/20 text-gray-400' }
  const isAnimated = agent.status === 'thinking' || agent.status === 'working'

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${role.color}`}>
          {role.label}
        </span>
        <div className="flex items-center gap-1">
          <Icon className={`w-3.5 h-3.5 ${config.color} ${isAnimated ? 'animate-spin' : ''}`} />
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
      </div>

      {agent.currentTask && (
        <p className="text-xs text-text-secondary mb-2 truncate">{agent.currentTask}</p>
      )}

      {agent.output.length > 0 && (
        <div className="bg-bg-primary rounded p-2 max-h-24 overflow-y-auto">
          {agent.output.slice(-4).map((line, i) => (
            <p key={i} className="text-xs text-text-muted font-mono truncate">{line}</p>
          ))}
        </div>
      )}

      {agent.filesChanged.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.filesChanged.map((file, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-bg-hover text-text-secondary rounded px-1.5 py-0.5"
            >
              <FileCode className="w-3 h-3" />
              {file.split('/').pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function AgentMonitor() {
  const { currentRun, runHistory, phase, currentWave, totalWaves } = useAgentStore()
  const phaseInfo = phaseConfig[phase]
  const PhaseIcon = phaseInfo.icon

  return (
    <div className="h-full flex flex-col border-l border-border">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          Agent Monitor
        </h2>
      </div>

      {/* Phase Indicator */}
      {phase !== 'idle' && (
        <div className="px-3 py-2 border-b border-border bg-bg-secondary/50">
          <div className="flex items-center gap-2 mb-1">
            <PhaseIcon className={`w-4 h-4 ${phaseInfo.color} ${phase === 'planning' || phase === 'executing' || phase === 'verifying' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-semibold ${phaseInfo.color}`}>{phaseInfo.label}</span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1 mt-1">
            {['planning', 'executing', 'verifying'].map((p, i) => {
              const phases = ['planning', 'executing', 'verifying', 'done']
              const currentIdx = phases.indexOf(phase)
              const isCompleted = currentIdx > i
              const isActive = phases[i] === phase
              return (
                <div
                  key={p}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    isCompleted ? 'bg-success' : isActive ? 'bg-accent animate-pulse' : 'bg-border'
                  }`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-muted">Plan</span>
            <span className="text-[10px] text-text-muted">Execute</span>
            <span className="text-[10px] text-text-muted">Verify</span>
          </div>
          {totalWaves > 0 && (
            <p className="text-[10px] text-text-muted mt-1">
              Wave {currentWave}/{totalWaves}
            </p>
          )}
        </div>
      )}

      {/* Agents */}
      <div className="flex-1 overflow-y-auto p-3">
        {currentRun ? (
          <>
            {currentRun.agents.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Initialisiere Agenten...
              </div>
            ) : (
              currentRun.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Bot className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs text-center">
              Keine aktiven Agenten.
              <br />
              Starte einen Task im Chat.
            </p>
          </div>
        )}

        {/* History */}
        {runHistory.length > 0 && !currentRun && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
              Letzte Runs
            </h3>
            {runHistory.slice(0, 5).map((run) => (
              <div key={run.id} className="mb-2 p-2 bg-bg-hover rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary truncate max-w-[70%]">
                    {run.prompt}
                  </span>
                  <span className="text-text-muted">
                    {run.agents.length} Agenten
                  </span>
                </div>
                {run.summary && (
                  <p className="text-text-muted mt-1 truncate">{run.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
