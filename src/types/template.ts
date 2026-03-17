export interface TemplateStep {
  prompt: string
  role?: string
  model?: string
}

export type TemplateCategory = 'analysis' | 'generation' | 'review' | 'deployment' | 'custom'

export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: TemplateCategory
  steps: TemplateStep[]
}
