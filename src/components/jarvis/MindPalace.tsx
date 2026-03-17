import { motion, AnimatePresence } from 'framer-motion'
import { BrainCircuit, X, Database, ListTodo, ActivitySquare, Cpu, FileCode, Clock } from 'lucide-react'
import { useAgentStore, type PendingPlan } from '../../stores/agentStore'
import { useProjectStore } from '../../stores/projectStore'
import type { AgentInstance } from '../../types/agent'

function AgentCard({ agent }: { agent: AgentInstance }) {
  const isActive = agent.status === 'thinking' || agent.status === 'working'
  return (
    <div className={`glass rounded-lg p-2.5 ${isActive ? 'animate-border-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-hud text-accent">{agent.role}</span>
        <span className={`text-[9px] font-mono ${isActive ? 'text-accent' : agent.status === 'done' ? 'text-text-muted' : 'text-danger'}`}>
          {agent.status}
        </span>
      </div>
      {agent.currentTask && (
        <p className="text-[10px] text-text-secondary truncate">{agent.currentTask}</p>
      )}
      {agent.output.length > 0 && (
        <p className="text-[9px] text-text-muted font-mono mt-1 truncate">
          {agent.output[agent.output.length - 1]}
        </p>
      )}
    </div>
  )
}

function PlanSection({ plan }: { plan: PendingPlan }) {
  return (
    <div className="space-y-2">
      {plan.goals.map((goal, i) => (
        <p key={i} className="text-xs text-text-secondary">
          <span className="text-accent mr-2">{'>'}</span>{goal}
        </p>
      ))}
      <div className="space-y-1 mt-2">
        {plan.tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-2 glass rounded-md px-2.5 py-1.5 text-[10px]">
            <FileCode className="w-3 h-3 text-text-muted shrink-0" />
            <span className="text-text-primary flex-1 truncate">{task.name}</span>
            {task.role && (
              <span className="font-mono text-[8px] text-text-muted bg-bg-surface px-1 rounded">{task.role}</span>
            )}
            <span className="font-mono text-[8px] text-cyan">{task.model}</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-text-muted font-mono">{plan.waveCount} Wellen</p>
    </div>
  )
}

interface MindPalaceProps {
  isOpen: boolean
  onClose: () => void
}

export function MindPalace({ isOpen, onClose }: MindPalaceProps) {
  const currentRun = useAgentStore((s) => s.currentRun)
  const pendingPlan = useAgentStore((s) => s.pendingPlan)
  const runHistory = useAgentStore((s) => s.runHistory)
  const phase = useAgentStore((s) => s.phase)
  const tasks = useProjectStore((s) => s.tasks)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-bg-deep/50 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-screen w-96 glass-elevated border-l border-border z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-violet animate-pulse-glow" />
                <h2 className="font-hud text-sm text-text-primary">Mind Palace</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Active Agents */}
              {currentRun && currentRun.agents.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Active Agents ({currentRun.agents.length})</span>
                  </div>
                  <div className="space-y-2">
                    {currentRun.agents.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </section>
              )}

              {/* Pending Plan */}
              {pendingPlan && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <ActivitySquare className="w-3.5 h-3.5" />
                    <span>Pending Plan</span>
                  </div>
                  <PlanSection plan={pendingPlan} />
                </section>
              )}

              {/* Project Tasks */}
              {tasks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Project Tasks ({tasks.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {tasks.slice(0, 8).map((task) => (
                      <div key={task.id} className="flex items-start gap-2 text-xs">
                        <span className={`mt-0.5 ${
                          task.status === 'done' ? 'text-accent' : task.status === 'in_progress' ? 'text-cyan' : 'text-text-muted'
                        }`}>
                          {task.status === 'done' ? '✓' : '▹'}
                        </span>
                        <span className="text-text-secondary font-mono">{task.title}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Run History */}
              {runHistory.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <Clock className="w-3.5 h-3.5" />
                    <span>History ({runHistory.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {runHistory.slice(0, 5).map((run) => (
                      <div key={run.id} className="glass rounded-md p-2 text-[10px]">
                        <p className="text-text-secondary truncate">{run.prompt}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-text-muted">{run.agents.length} agents</span>
                          <span className={`font-mono ${run.status === 'completed' ? 'text-accent' : 'text-danger'}`}>
                            {run.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State */}
              {!currentRun && !pendingPlan && runHistory.length === 0 && tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-text-muted">
                  <Database className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-xs font-mono text-center">
                    Noch keine Daten.<br />Starte eine Aufgabe um den Mind Palace zu füllen.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
