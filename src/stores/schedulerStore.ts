import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import type { ScheduledTask, ScheduleInterval } from '../types/scheduler'
import { getNextRun, startScheduler, stopScheduler } from '../services/scheduler'
import { useNotificationStore } from './notificationStore'

interface SchedulerStore {
  tasks: ScheduledTask[]
  isRunning: boolean

  loadTasks: (projectId: string) => Promise<void>
  addTask: (projectId: string, name: string, prompt: string, interval: ScheduleInterval) => Promise<void>
  removeTask: (id: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  start: () => void
  stop: () => void
}

export const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  tasks: [],
  isRunning: false,

  loadTasks: async (projectId: string) => {
    try {
      const tasks = await invoke<ScheduledTask[]>('db_list_scheduled', { projectId })
      set({ tasks })
    } catch {
      set({ tasks: [] })
    }
  },

  addTask: async (projectId, name, prompt, interval) => {
    const now = new Date().toISOString()
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      project_id: projectId,
      name,
      prompt,
      schedule_interval: interval,
      enabled: true,
      last_run: null,
      next_run: getNextRun(interval),
      created_at: now,
      updated_at: now,
    }
    try {
      await invoke('db_save_scheduled', { task })
      set((s) => ({ tasks: [...s.tasks, task] }))
    } catch {
      useNotificationStore.getState().addNotification('error', 'Zeitplan konnte nicht erstellt werden.')
    }
  },

  removeTask: async (id) => {
    try {
      await invoke('db_delete_scheduled', { id })
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    } catch {
      useNotificationStore.getState().addNotification('error', 'Zeitplan konnte nicht gelöscht werden.')
    }
  },

  toggleTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    const updated = { ...task, enabled: !task.enabled, updated_at: new Date().toISOString() }
    try {
      await invoke('db_save_scheduled', { task: updated })
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }))
    } catch {
      useNotificationStore.getState().addNotification('error', 'Zeitplan konnte nicht umgeschaltet werden.')
    }
  },

  start: () => {
    startScheduler()
    set({ isRunning: true })
  },

  stop: () => {
    stopScheduler()
    set({ isRunning: false })
  },
}))
