import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrainCircuit, X, Database, ListTodo, ActivitySquare, Cpu, FileCode, Clock, ChevronDown, ChevronRight, GitBranch } from 'lucide-react'
import { useAgentStore, type PendingPlan } from '../../stores/agentStore'
import { useProjectStore } from '../../stores/projectStore'
import { useGitStore } from '../../stores/gitStore'
import { GitActions } from './GitActions'
import type { AgentInstance, AgentRun } from '../../types/agent'

function AgentCard({ agent, expanded = false }: { agent: AgentInstance; expanded?: boolean }) {
  const [showOutput, setShowOutput] = useState(expanded)
  const isActive = agent.status === 'thinking' || agent.status === 'working'
  const statusColor = isActive ? 'text-accent' : agent.status === 'done' ? 'text-accent' : 'text-danger'

  return (
    <div className={`glass rounded-lg p-3 ${isActive ? 'animate-border-pulse' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 text-text-muted" />
          <span className="text-[10px] font-hud text-accent">{agent.role}</span>
        </div>
        <span className={`text-[9px] font-mono ${statusColor}`}>
          {agent.status}
        </span>
      </div>

      {agent.currentTask && (
        <p className="text-[10px] text-text-secondary mb-1.5">{agent.currentTask}</p>
      )}

      {agent.output.length > 0 && (
        <>
          <button
            onClick={() => setShowOutput(!showOutput)}
            aria-expanded={showOutput}
            className="flex items-center gap-1 text-[9px] text-text-muted hover:text-accent transition-colors mb-1"
          >
            {showOutput ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {agent.output.length} Zeilen Output
          </button>

          <AnimatePresence>
            {showOutput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-bg-deep/60 rounded-md p-2.5 max-h-60 overflow-y-auto">
                  {agent.output.map((line, i) => (
                    <p key={i} className="text-[10px] text-text-muted font-mono whitespace-pre-wrap break-words leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

function RunHistoryCard({ run }: { run: AgentRun }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full p-3 text-left hover:bg-bg-hover transition-colors"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-text-primary truncate flex-1 mr-2">{run.prompt}</p>
          {expanded ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" /> : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />}
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="font-mono text-text-muted">{run.agents.length} agents</span>
          <span className={`font-mono ${run.status === 'completed' ? 'text-accent' : 'text-danger'}`}>
            {run.status}
          </span>
          {run.finishedAt && (
            <span className="font-mono text-text-muted">
              {new Date(run.finishedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
              {run.summary && (
                <p className="text-[10px] text-text-secondary italic">{run.summary}</p>
              )}
              {run.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const tasks = useProjectStore((s) => s.tasks)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const gitStatus = useGitStore((s) => s.status)
  const gitCommits = useGitStore((s) => s.commits)

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
            className="fixed top-0 right-0 h-screen w-[420px] glass-elevated border-l border-border z-50 flex flex-col overflow-hidden"
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
                      <AgentCard key={agent.id} agent={agent} expanded />
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

              {/* Git Intelligence */}
              {gitStatus?.is_git_repo && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Git ({gitStatus.branch})</span>
                  </div>

                  {gitStatus.files.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <p className="text-[9px] font-hud text-text-muted mb-1.5">
                        {gitStatus.files.length} ungespeicherte Änderungen
                      </p>
                      {gitStatus.files.slice(0, 8).map((file) => (
                        <div key={file.path} className="flex items-center gap-2 text-[10px]">
                          <span className={`font-mono w-5 text-center ${
                            file.status === 'M' ? 'text-warning' :
                            file.status === 'A' ? 'text-accent' :
                            file.status === 'D' ? 'text-danger' : 'text-text-muted'
                          }`}>{file.status}</span>
                          <span className="text-text-secondary font-mono truncate">{file.path}</span>
                        </div>
                      ))}
                      {gitStatus.files.length > 8 && (
                        <p className="text-[9px] text-text-muted">+{gitStatus.files.length - 8} weitere</p>
                      )}
                    </div>
                  )}

                  {gitCommits.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-hud text-text-muted mb-1.5">Letzte Commits</p>
                      {gitCommits.slice(0, 5).map((c) => (
                        <div key={c.hash} className="glass rounded-md px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] text-cyan shrink-0">{c.short_hash}</span>
                            <span className="text-[10px] text-text-primary truncate flex-1">{c.message}</span>
                          </div>
                          <div className="flex gap-2 mt-0.5">
                            <span className="text-[8px] text-text-muted">{c.author}</span>
                            <span className="text-[8px] text-text-muted">
                              {new Date(c.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Git Actions */}
                  {activeProject?.path && (
                    <GitActions projectPath={activeProject.path} />
                  )}
                </section>
              )}

              {/* Run History — klickbar mit Agent-Details */}
              {runHistory.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 text-text-secondary font-hud text-[10px] mb-3">
                    <Clock className="w-3.5 h-3.5" />
                    <span>History ({runHistory.length})</span>
                  </div>
                  <div className="space-y-2">
                    {runHistory.slice(0, 10).map((run) => (
                      <RunHistoryCard key={run.id} run={run} />
                    ))}
                  </div>
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
