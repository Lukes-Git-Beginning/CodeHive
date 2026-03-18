import { useAgentStore } from '../../stores/agentStore'
import { Cpu, Search, Shield, Wrench, Eye, Code } from 'lucide-react'

const ROLE_CONFIG: Record<string, { icon: typeof Cpu; label: string; color: string }> = {
  orchestrator: { icon: Search, label: 'Orchestrator', color: 'text-violet' },
  frontend: { icon: Eye, label: 'Frontend', color: 'text-cyan' },
  backend: { icon: Wrench, label: 'Backend', color: 'text-accent' },
  testing: { icon: Shield, label: 'Testing', color: 'text-success' },
  architect: { icon: Code, label: 'Architect', color: 'text-holo-blue' },
  devops: { icon: Wrench, label: 'DevOps', color: 'text-warning' },
  security: { icon: Shield, label: 'Security', color: 'text-danger' },
  uiux: { icon: Eye, label: 'UI/UX', color: 'text-violet' },
}

export function AgentsPanel() {
  const currentRun = useAgentStore((s) => s.currentRun)
  const agents = currentRun?.agents || []

  return (
    <div className="p-4 space-y-4">
      {/* Active Agents */}
      <div>
        <h3 className="font-hud text-[10px] text-text-muted mb-3">
          {agents.length > 0 ? `ACTIVE AGENTS (${agents.length})` : 'NO ACTIVE AGENTS'}
        </h3>

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <Cpu className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-xs">Keine Agenten aktiv. Starte eine Aufgabe um Agenten zu sehen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {agents.map((agent) => {
              const config = ROLE_CONFIG[agent.role] || { icon: Cpu, label: agent.role, color: 'text-text-secondary' }
              const Icon = config.icon
              const isActive = agent.status === 'working' || agent.status === 'thinking'

              return (
                <div key={agent.id} className="glass rounded-lg p-4 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-bg-surface flex items-center justify-center shrink-0 ${isActive ? 'animate-pulse-glow' : ''}`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-hud text-[10px] text-text-primary">{config.label}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-accent animate-pulse' : agent.status === 'done' ? 'bg-success' : agent.status === 'error' ? 'bg-danger' : 'bg-text-muted'}`} />
                    </div>
                    <p className="text-[10px] text-text-muted truncate">{agent.currentTask || 'Idle'}</p>
                    <p className="text-[9px] text-text-muted font-mono mt-1">{agent.status}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Available Roles */}
      <div>
        <h3 className="font-hud text-[10px] text-text-muted mb-3">AVAILABLE ROLES</h3>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(ROLE_CONFIG).map(([role, config]) => {
            const Icon = config.icon
            return (
              <div key={role} className="glass-holo rounded-lg p-3 flex flex-col items-center gap-1.5 text-center">
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="font-hud text-[8px] text-text-secondary">{config.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
