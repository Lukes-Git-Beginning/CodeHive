export type ScheduleInterval = '15min' | '1h' | '6h' | 'daily' | 'weekly'

export interface ScheduledTask {
  id: string
  project_id: string
  name: string
  prompt: string
  schedule_interval: ScheduleInterval
  enabled: boolean
  last_run: string | null
  next_run: string | null
  created_at: string
  updated_at: string
}
