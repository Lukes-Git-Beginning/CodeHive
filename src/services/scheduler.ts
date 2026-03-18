import { invoke } from '@tauri-apps/api/core'
import type { ScheduledTask, ScheduleInterval } from '../types/scheduler'
import { useProjectStore } from '../stores/projectStore'
import { orchestrate } from './orchestrator'

let schedulerInterval: ReturnType<typeof setInterval> | null = null
let isTickRunning = false

const INTERVAL_MS: Record<ScheduleInterval, number> = {
  '15min': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  'daily': 24 * 60 * 60_000,
  'weekly': 7 * 24 * 60 * 60_000,
}

export function getNextRun(interval: ScheduleInterval, from?: Date): string {
  const base = from ?? new Date()
  return new Date(base.getTime() + INTERVAL_MS[interval]).toISOString()
}

export const INTERVAL_LABELS: Record<ScheduleInterval, string> = {
  '15min': 'Alle 15 Minuten',
  '1h': 'Stündlich',
  '6h': 'Alle 6 Stunden',
  'daily': 'Täglich',
  'weekly': 'Wöchentlich',
}

async function tick() {
  if (isTickRunning) return
  isTickRunning = true
  try {
  const project = useProjectStore.getState().getActiveProject()
  if (!project) return

  let tasks: ScheduledTask[] = []
  try {
    tasks = await invoke<ScheduledTask[]>('db_list_scheduled', { projectId: project.id })
  } catch {
    return
  }

  const now = new Date()
  for (const task of tasks) {
    if (!task.enabled || !task.next_run) continue
    if (new Date(task.next_run) > now) continue

    // Time to run
    try {
      await orchestrate(task.prompt, project)
    } catch (err) {
      console.error(`Scheduled task "${task.name}" failed:`, err)
    }

    // Update next_run + last_run
    const updated: ScheduledTask = {
      ...task,
      last_run: now.toISOString(),
      next_run: getNextRun(task.schedule_interval, now),
      updated_at: now.toISOString(),
    }
    try {
      await invoke('db_save_scheduled', { task: updated })
    } catch {
      // best-effort
    }
  }
  } finally {
    isTickRunning = false
  }
}

export function startScheduler() {
  if (schedulerInterval) return
  schedulerInterval = setInterval(tick, 60_000)
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
  }
}
