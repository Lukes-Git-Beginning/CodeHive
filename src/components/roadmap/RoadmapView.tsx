import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle, Clock, Loader2, ChevronRight, Play, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import { useAgentStore } from '../../stores/agentStore'
import { useChatStore } from '../../stores/chatStore'
import { orchestrate } from '../../services/orchestrator'
import { useNotificationStore } from '../../stores/notificationStore'
import { useTeamStore } from '../../stores/teamStore'
import type { Task } from '../../types/project'
import type { ChatMessage } from '../../types/agent'

const columns = [
  { id: 'planned' as const, label: 'Planned', icon: Clock, color: 'text-text-muted', borderColor: 'border-white/5' },
  { id: 'in_progress' as const, label: 'In Progress', icon: Loader2, color: 'text-cyan', borderColor: 'border-cyan/20' },
  { id: 'done' as const, label: 'Complete', icon: CheckCircle, color: 'text-accent', borderColor: 'border-accent/20' },
]

export function RoadmapView() {
  const tasks = useProjectStore((s) => s.tasks)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const addTask = useProjectStore((s) => s.addTask)
  const updateTask = useProjectStore((s) => s.updateTask)
  const removeTask = useProjectStore((s) => s.removeTask)
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const phase = useAgentStore((s) => s.phase)
  const isRunning = phase !== 'idle' && phase !== 'done'
  const addMessage = useChatStore((s) => s.addMessage)
  const setProcessing = useChatStore((s) => s.setProcessing)
  const members = useTeamStore((s) => s.members)
  const assignments = useTeamStore((s) => s.assignments)
  const assignTask = useTeamStore((s) => s.assignTask)
  const unassignTask = useTeamStore((s) => s.unassignTask)
  const loadMembers = useTeamStore((s) => s.loadMembers)
  const loadAssignments = useTeamStore((s) => s.loadAssignments)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)

  // Load team data
  useEffect(() => { loadMembers(); loadAssignments() }, [])

  const projectTasks = tasks.filter((t) => t.projectId === activeProjectId)

  const handleAddTask = (status: Task['status']) => {
    if (!newTaskTitle.trim() || !activeProjectId) return
    addTask({
      id: crypto.randomUUID(),
      projectId: activeProjectId,
      title: newTaskTitle.trim(),
      description: '',
      status,
      priority: 0,
      createdAt: new Date().toISOString(),
    })
    setNewTaskTitle('')
    setAddingToColumn(null)
  }

  const moveTask = (taskId: string, newStatus: Task['status']) => {
    updateTask(taskId, {
      status: newStatus,
      ...(newStatus === 'done' ? { completedAt: new Date().toISOString() } : {}),
    })
  }

  const handleExecuteTask = async (task: Task) => {
    if (!activeProject || isRunning) {
      useNotificationStore.getState().addNotification('warning', 'Metis arbeitet bereits an einer Aufgabe.')
      return
    }

    // Mark as in_progress
    updateTask(task.id, { status: 'in_progress' })

    // Build prompt from task
    const prompt = task.description
      ? `${task.title}\n\n${task.description}`
      : task.title

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `[Roadmap-Task] ${prompt}`,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMessage)
    setProcessing(true)

    try {
      await orchestrate(prompt, activeProject)
      // Mark as done after successful completion
      updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() })
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Task fehlgeschlagen: ${String(err)}`,
        timestamp: new Date().toISOString(),
      })
      // Revert to planned on failure
      updateTask(task.id, { status: 'planned' })
      setProcessing(false)
    }
  }

  if (!activeProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted font-mono">Wähle zuerst ein Projekt.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="font-hud text-sm text-accent text-glow-green mb-6">Mission Board</h2>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">
        {columns.map((col) => {
          const Icon = col.icon
          const colTasks = projectTasks.filter((t) => t.status === col.id)

          return (
            <div key={col.id} className="flex flex-col min-h-0">
              {/* Column Header */}
              <div className={`glass rounded-t-xl px-4 py-3 border-b ${col.borderColor} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${col.color}`} />
                  <span className={`font-hud text-[10px] ${col.color}`}>{col.label}</span>
                  <span className="text-[10px] text-text-muted font-mono bg-white/5 rounded-full px-1.5">
                    {colTasks.length}
                  </span>
                </div>
                {col.id === 'planned' && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setAddingToColumn(col.id)}
                    className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto space-y-2 p-2 glass rounded-b-xl">
                <AnimatePresence>
                  {addingToColumn === col.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="glass-accent rounded-lg p-3 mb-1">
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask(col.id)
                            if (e.key === 'Escape') setAddingToColumn(null)
                          }}
                          placeholder="Task-Titel..."
                          autoFocus
                          className="w-full bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none font-mono"
                        />
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => handleAddTask(col.id)}
                            className="text-[10px] font-hud bg-accent/20 text-accent px-2 py-0.5 rounded"
                          >
                            Hinzufügen
                          </button>
                          <button
                            onClick={() => setAddingToColumn(null)}
                            className="text-[10px] text-text-muted px-2 py-0.5"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {colTasks.length === 0 && addingToColumn !== col.id && (
                  <div className="flex items-center justify-center h-20 text-text-muted">
                    <p className="text-[10px] font-mono">Leer</p>
                  </div>
                )}

                {colTasks.map((task) => {
                  const taskAssignment = assignments.find((a) => a.task_id === task.id)
                  const assignedMember = taskAssignment ? members.find((m) => m.id === taskAssignment.member_id) : null

                  return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass neon-hover rounded-lg p-3 group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-xs text-text-primary flex-1">{task.title}</p>
                      {assignedMember ? (
                        <div
                          className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[7px] font-bold text-bg-deep cursor-pointer"
                          style={{ backgroundColor: assignedMember.avatar_color }}
                          title={`${assignedMember.name} (${assignedMember.role})`}
                          onClick={() => { if (taskAssignment) unassignTask(taskAssignment.id) }}
                        >
                          {assignedMember.name.charAt(0).toUpperCase()}
                        </div>
                      ) : members.length > 0 ? (
                        <select
                          className="text-[8px] font-mono bg-transparent text-text-muted border border-white/5 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          value=""
                          onChange={(e) => { if (e.target.value) assignTask(task.id, e.target.value) }}
                        >
                          <option value="">Zuweisen</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>

                    {task.description && (
                      <p className="text-[10px] text-text-muted mb-2 line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Execute button (only for planned tasks) */}
                      {col.id === 'planned' && (
                        <button
                          onClick={() => handleExecuteTask(task)}
                          disabled={isRunning}
                          className="text-[9px] font-hud text-accent bg-accent/10 hover:bg-accent/20 px-2 py-0.5 rounded flex items-center gap-0.5 disabled:opacity-30"
                          title="Metis ausführen lassen"
                        >
                          <Play className="w-2.5 h-2.5" />
                          Ausführen
                        </button>
                      )}

                      {/* Move buttons */}
                      {columns
                        .filter((c) => c.id !== col.id)
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => moveTask(task.id, c.id)}
                            className={`text-[9px] font-mono ${c.color} bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded flex items-center gap-0.5`}
                          >
                            <ChevronRight className="w-2.5 h-2.5" />
                            {c.label}
                          </button>
                        ))}

                      {/* Delete */}
                      <button
                        onClick={() => removeTask(task.id)}
                        className="text-[9px] text-text-muted hover:text-danger px-1 py-0.5 rounded ml-auto"
                        title="Löschen"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
