import { useState } from 'react'
import { Plus, GripVertical, CheckCircle, Clock, Loader2 } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'
import type { Task } from '../../types/project'

const columns = [
  { id: 'planned', label: 'Geplant', icon: Clock, color: 'text-text-muted' },
  { id: 'in_progress', label: 'In Arbeit', icon: Loader2, color: 'text-accent' },
  { id: 'done', label: 'Fertig', icon: CheckCircle, color: 'text-success' },
] as const

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
      <div className="flex items-center justify-center h-full text-text-muted">
        <p>Wähle zuerst ein Projekt aus.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-6">
      <h2 className="text-xl font-bold mb-6">Roadmap</h2>

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {columns.map((col) => {
          const Icon = col.icon
          const colTasks = projectTasks.filter((t) => t.status === col.id)

          return (
            <div key={col.id} className="flex flex-col min-h-0">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs bg-bg-hover text-text-muted rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => setAddingToColumn(col.id)}
                  className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {addingToColumn === col.id && (
                  <div className="bg-bg-card border border-accent/50 rounded-lg p-3">
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
                      className="w-full bg-transparent text-sm text-text-primary placeholder-text-muted
                                 focus:outline-none"
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleAddTask(col.id)}
                        className="text-xs bg-accent text-bg-primary px-2 py-1 rounded"
                      >
                        Hinzufügen
                      </button>
                      <button
                        onClick={() => setAddingToColumn(null)}
                        className="text-xs text-text-muted px-2 py-1"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}

                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-bg-card border border-border rounded-lg p-3 group hover:border-border/80"
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-text-muted mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick move buttons */}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {columns
                        .filter((c) => c.id !== col.id)
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => moveTask(task.id, c.id)}
                            className="text-xs text-text-muted hover:text-text-secondary px-1.5 py-0.5 bg-bg-hover rounded"
                          >
                            → {c.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
