export interface TeamMember {
  id: string
  name: string
  role: string
  email?: string
  avatar_color: string
  created_at: string
}

export interface TaskAssignment {
  id: string
  task_id: string
  member_id: string
  assigned_at: string
}
