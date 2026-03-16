import { Bot, CheckCircle, AlertCircle, Loader2, Clock, FileCode } from 'lucide-react'
import { useAgentStore } from '../../stores/agentStore'
import type { AgentInstance, AgentStatus } from '../../types/agent'

const statusConfig: Record<AgentStatus, { icon: typeof Bot; color: string; label: string }> = {
  idle: { icon: Clock, color: 'text-text-muted', label: 'Bereit' },
  thinking: { icon: Loader2, color: 'text-blue-400', label: 'Denkt nach...' },
  working: { icon: Loader2, color: 'text-accent', label: 'Arbeitet...' },
  done: { icon: CheckCircle, color: 'text-success', label: 'Fertig' },
  error: { icon: AlertCircle, color: 'text-error', label: 'Fehler' },
}

const roleLabels: Record<string, string> = {
  orchestrator: 'Orchestrator',
  frontend: 'Frontend',
  backend: 'Backend',
  testing: 'Testing',
  devops: 'DevOps',
  uiux: 'UI/UX',
  security: 'Security',
  architect: 'Architect',
}

function AgentCard({ agent }: { agent: AgentInstance }) {
  const config = statusConfig[agent.status]
  const Icon = config.icon
  const isAnimated = agent.status === 'thinking' || agent.status === 'working'

  return (
    <div className="bg-bg-card border border-border rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bot className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm font-medium">{roleLabels[agent.role] || agent.role}</span>
        </div>
        <div className="flex items-center gap-1">
          <Icon className={`w-3.5 h-3.5 ${config.color} ${isAnimated ? 'animate-spin' : ''}`} />
          <span className={`text-xs ${config.color}`}>{config.label}</span>
        </div>
      </div>

      {agent.currentTask && (
        <p className="text-xs text-text-secondary mb-2 truncate">{agent.currentTask}</p>
      )}

      {/* Output (last 5 lines) */}
      {agent.output.length > 0 && (
        <div className="bg-bg-primary rounded p-2 max-h-32 overflow-y-auto">
          {agent.output.slice(-5).map((line, i) => (
            <p key={i} className="text-xs text-text-muted font-mono">{line}</p>
          ))}
        </div>
      )}

      {/* Changed files */}
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
  const { currentRun, runHistory } = useAgentStore()

  return (
    <div className="h-full flex flex-col border-l border-border">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" />
          Agent Monitor
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {currentRun ? (
          <>
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="text-xs font-medium text-success">Aktiver Run</span>
              </div>
              <p className="text-xs text-text-muted truncate">{currentRun.prompt}</p>
            </div>
            {currentRun.agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
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
        {runHistory.length > 0 && (
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
