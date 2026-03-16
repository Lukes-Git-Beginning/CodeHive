import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, CheckCircle, Clock, Loader2, ChevronRight } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { Task } from '../../types/project'

const columns = [
  { id: 'planned' as const, label: 'Planned', icon: Clock, color: 'text-text-muted', borderColor: 'border-white/5' },
  { id: 'in_progress' as const, label: 'In Progress', icon: Loader2, color: 'text-cyan', borderColor: 'border-cyan/20' },
  { id: 'done' as const, label: 'Complete', icon: CheckCircle, color: 'text-accent', borderColor: 'border-accent/20' },
]

export function RoadmapView() {
  const { tasks, activeProjectId, addTask, updateTask } = useProjectStore()
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)

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

  if (!activeProjectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-muted font-mono">Select a project first.</p>
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
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAddingToColumn(col.id)}
                  className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </motion.button>
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
                          placeholder="Task title..."
                          autoFocus
                          className="w-full bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none font-mono"
                        />
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => handleAddTask(col.id)}
                            className="text-[10px] font-hud bg-accent/20 text-accent px-2 py-0.5 rounded"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => setAddingToColumn(null)}
                            className="text-[10px] text-text-muted px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {colTasks.length === 0 && addingToColumn !== col.id && (
                  <div className="flex items-center justify-center h-20 text-text-muted">
                    <p className="text-[10px] font-mono">Empty</p>
                  </div>
                )}

                {colTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass neon-hover rounded-lg p-3 group"
                  >
                    <p className="text-xs text-text-primary mb-2">{task.title}</p>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
