export interface Project {
  id: string
  name: string
  path: string
  techStack: string[]
  description: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'done'
  priority: number
  milestone?: string
  createdAt: string
  completedAt?: string
}
