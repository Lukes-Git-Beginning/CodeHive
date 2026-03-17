import type { Project } from '../types/project'
import { useProfileStore } from '../stores/profileStore'

interface ResearchSuggestion {
  id: string
  topic: string
  reason: string
  searchQuery: string
}

/**
 * Generate research suggestions based on project context and user profile.
 * Metis identifies areas where web research could improve her capabilities.
 */
export function generateResearchSuggestions(project: Project): ResearchSuggestion[] {
  const profile = useProfileStore.getState().profile
  const suggestions: ResearchSuggestion[] = []

  // Security best practices for the tech stack
  if (project.techStack.some((t) => ['Flask', 'Python', 'Django'].includes(t))) {
    if ((profile.taskTypeFrequency['security'] || 0) > 0) {
      suggestions.push({
        id: 'research-flask-security',
        topic: 'Flask Security Best Practices 2026',
        reason: 'Du führst regelmäßig Security-Audits durch. Aktuelle Best Practices könnten helfen.',
        searchQuery: 'Flask security best practices OWASP 2026 SQL injection prevention',
      })
    }
  }

  // Testing patterns
  if (project.techStack.some((t) => ['React', 'TypeScript', 'Node.js'].includes(t))) {
    if ((profile.taskTypeFrequency['test'] || 0) < 2) {
      suggestions.push({
        id: 'research-testing',
        topic: 'Testing-Strategien für React + TypeScript',
        reason: 'Metis möchte bessere Tests schreiben. Aktuelle Patterns recherchieren?',
        searchQuery: 'React TypeScript testing best practices vitest 2026',
      })
    }
  }

  // Performance
  if (project.techStack.includes('React')) {
    suggestions.push({
      id: 'research-performance',
      topic: 'React 19 Performance-Optimierungen',
      reason: 'Metis könnte neue React 19 Features nutzen um die App schneller zu machen.',
      searchQuery: 'React 19 performance optimization server components 2026',
    })
  }

  // DevOps if no CI/CD detected
  if (project.techStack.some((t) => ['Docker', 'Node.js', 'Python'].includes(t))) {
    suggestions.push({
      id: 'research-devops',
      topic: 'Deployment & DevOps Patterns',
      reason: 'Metis möchte lernen wie man dieses Projekt optimal deployen kann.',
      searchQuery: `${project.techStack.join(' ')} deployment Docker CI CD best practices 2026`,
    })
  }

  return suggestions.slice(0, 2)
}

/**
 * Execute a web research task using the orchestrator.
 * Creates a prompt that instructs the agent to research and summarize findings.
 */
export function buildResearchPrompt(suggestion: ResearchSuggestion): string {
  return `Recherchiere im Internet zu folgendem Thema und fasse die wichtigsten Erkenntnisse zusammen:

Thema: ${suggestion.topic}
Suchbegriffe: ${suggestion.searchQuery}

Erstelle eine kurze, actionable Zusammenfassung mit:
1. Die 3-5 wichtigsten Erkenntnisse
2. Konkrete Empfehlungen für unser Projekt
3. Links zu relevanten Ressourcen (falls gefunden)

Halte die Zusammenfassung unter 500 Wörtern.`
}
