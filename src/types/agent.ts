export type AgentRole =
  | 'orchestrator'
  | 'frontend'
  | 'backend'
  | 'testing'
  | 'devops'
  | 'uiux'
  | 'security'
  | 'architect'

export type AgentStatus = 'idle' | 'thinking' | 'working' | 'done' | 'error'

export interface AgentInstance {
  id: string
  role: AgentRole
  status: AgentStatus
  currentTask: string
  output: string[]
  filesChanged: string[]
  startedAt: string
  finishedAt?: string
}

export interface AgentRun {
  id: string
  projectId: string
  taskId?: string
  agents: AgentInstance[]
  prompt: string
  status: 'running' | 'completed' | 'failed' | 'rejected'
  summary?: string
  startedAt: string
  finishedAt?: string
}

// ── Blackboard (Inter-Agent Communication) ──

export interface BlackboardEntry {
  id: string
  key: string
  value: string
  type: 'finding' | 'warning' | 'request' | 'artifact' | 'conflict'
  sourceAgentId: string
  sourceRole: AgentRole | string
  waveIndex: number
  timestamp: string
}

export interface FileConflict {
  file: string
  agentIds: string[]
  agentRoles: string[]
  resolved: boolean
  resolution?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'orchestrator' | 'agent' | 'system'
  agentRole?: AgentRole
  content: string
  timestamp: string
}
