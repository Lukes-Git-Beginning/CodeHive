import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, ListPlus, X, Clock, Cpu } from 'lucide-react'
import type { AgentRun } from '../../types/agent'
import { useProjectStore } from '../../stores/projectStore'
import { saveTask } from '../../services/persistence'
import { useNotificationStore } from '../../stores/notificationStore'

interface ResultsSummaryProps {
  run: AgentRun
  onClose: () => void
}

function formatDuration(start: string, end?: string): string {
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : Date.now()
  const seconds = Math.floor((e - s) / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function ResultsSummary({ run, onClose }: ResultsSummaryProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [addingTasks, setAddingTasks] = useState(false)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const addNotification = useNotificationStore((s) => s.addNotification)
  const loadTasksForProject = useProjectStore((s) => s.loadTasksForProject)

  const isSuccess = run.status === 'completed'
  const duration = formatDuration(run.startedAt, run.finishedAt)

  const toggleAgent = (id: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddToRoadmap = async () => {
    if (!activeProject || addingTasks) return
    setAddingTasks(true)

    try {
      // Create a task from each agent's work
      for (const agent of run.agents) {
        if (agent.output.length === 0) continue

        const task = {
          id: crypto.randomUUID(),
          projectId: activeProject.id,
          title: `[${agent.role}] ${agent.currentTask?.slice(0, 60) || run.prompt.slice(0, 60)}`,
          description: agent.output.slice(-10).join('\n').slice(0, 2000),
          status: 'planned' as const,
          priority: agent.role === 'security' ? 3 : agent.role === 'testing' ? 2 : 1,
          createdAt: new Date().toISOString(),
        }

        await saveTask(task)
      }

      await loadTasksForProject(activeProject.id)
      addNotification('success', `${run.agents.length} Tasks zur Roadmap hinzugefügt`)
      onClose()
    } catch (err) {
      addNotification('error', `Fehler beim Erstellen der Tasks: ${err}`)
    } finally {
      setAddingTasks(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-elevated rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {isSuccess ? (
              <CheckCircle className="w-6 h-6 text-accent" />
            ) : (
              <XCircle className="w-6 h-6 text-danger" />
            )}
            <div>
              <h2 className="font-hud text-sm text-text-primary">
                Metis — Ergebnisse
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {duration}
                </span>
                <span className="text-[10px] font-mono text-text-muted flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> {run.agents.length} Agents
                </span>
                <span className={`text-[10px] font-hud ${isSuccess ? 'text-accent' : 'text-danger'}`}>
                  {isSuccess ? 'ERFOLGREICH' : 'FEHLGESCHLAGEN'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt */}
        <div className="px-6 py-3 border-b border-border/50 shrink-0">
          <p className="text-[10px] font-hud text-text-muted mb-1">Aufgabe</p>
          <p className="text-sm text-text-primary">{run.prompt}</p>
        </div>

        {/* Agent Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {run.agents.map((agent) => {
            const isExpanded = expandedAgents.has(agent.id)
            const agentSuccess = agent.status === 'done'

            return (
              <div key={agent.id} className="glass rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleAgent(agent.id)}
                  className="w-full p-3.5 text-left hover:bg-bg-hover transition-colors flex items-center gap-3"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${agentSuccess ? 'bg-accent' : 'bg-danger'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-hud text-[10px] text-accent">{agent.role}</span>
                      {agent.finishedAt && agent.startedAt && (
                        <span className="text-[9px] font-mono text-text-muted">
                          {formatDuration(agent.startedAt, agent.finishedAt)}
                        </span>
                      )}
                    </div>
                    {agent.currentTask && (
                      <p className="text-[11px] text-text-secondary truncate mt-0.5">{agent.currentTask}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-text-muted">{agent.output.length} Zeilen</span>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 border-t border-border/30">
                        <div className="bg-bg-deep/60 rounded-lg p-3 max-h-64 overflow-y-auto mt-2">
                          {agent.output.map((line, i) => (
                            <p key={i} className="text-[10px] text-text-secondary font-mono whitespace-pre-wrap break-words leading-relaxed">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-border shrink-0">
          <button
            onClick={handleAddToRoadmap}
            disabled={addingTasks || run.agents.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                       bg-accent/15 border border-accent/30 text-accent text-xs font-hud
                       hover:bg-accent/25 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]
                       disabled:opacity-30 transition-all"
          >
            <ListPlus className="w-4 h-4" />
            {addingTasks ? 'Wird erstellt...' : 'Zur Roadmap'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg glass text-text-secondary text-xs font-hud
                       hover:text-text-primary transition-all"
          >
            Schließen
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
