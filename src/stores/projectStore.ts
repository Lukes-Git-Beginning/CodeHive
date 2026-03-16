import { create } from 'zustand'
import type { Project, Task } from '../types/project'
import * as persistence from '../services/persistence'

interface ProjectStore {
  projects: Project[]
  activeProjectId: string | null
  tasks: Task[]
  initialized: boolean

  // Init
  initialize: () => Promise<void>

  // Projects
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => Promise<void>
  removeProject: (id: string) => Promise<void>
  setActiveProject: (id: string | null) => void
  getActiveProject: () => Project | undefined

  // Tasks
  setTasks: (tasks: Task[]) => void
  loadTasksForProject: (projectId: string) => Promise<void>
  addTask: (task: Task) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  removeTask: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  tasks: [],
  initialized: false,

  initialize: async () => {
    const projects = await persistence.loadProjects()
    const lastProjectId = await persistence.getSetting('last_active_project')

    set({
      projects,
      initialized: true,
      activeProjectId:
        lastProjectId && projects.some((p) => p.id === lastProjectId)
          ? lastProjectId
          : null,
    })

    // Load tasks for last active project
    if (lastProjectId && projects.some((p) => p.id === lastProjectId)) {
      const tasks = await persistence.loadTasks(lastProjectId)
      set({ tasks })
    }
  },

  setProjects: (projects) => set({ projects }),

  addProject: async (project) => {
    set((s) => ({ projects: [...s.projects, project] }))
    await persistence.saveProject(project)
  },

  removeProject: async (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
      tasks: s.activeProjectId === id ? [] : s.tasks,
    }))
    await persistence.deleteProject(id)
  },

  setActiveProject: (id) => {
    set({ activeProjectId: id })
    if (id) {
      persistence.setSetting('last_active_project', id)
      // Load tasks for this project
      get().loadTasksForProject(id)
    }
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get()
    return projects.find((p) => p.id === activeProjectId)
  },

  setTasks: (tasks) => set({ tasks }),

  loadTasksForProject: async (projectId) => {
    const tasks = await persistence.loadTasks(projectId)
    set({ tasks })
  },

  addTask: async (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }))
    await persistence.saveTask(task)
  },

  updateTask: async (id, updates) => {
    const { tasks } = get()
    const existing = tasks.find((t) => t.id === id)
    if (!existing) return

    const updated = { ...existing, ...updates }
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? updated : t)),
    }))
    await persistence.saveTask(updated)
  },

  removeTask: async (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    await persistence.deleteTask(id)
  },
}))
