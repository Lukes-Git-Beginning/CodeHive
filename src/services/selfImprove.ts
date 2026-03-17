import { useProfileStore } from '../stores/profileStore'
import { useProjectStore } from '../stores/projectStore'
import { orchestrate } from './orchestrator'
import { useChatStore } from '../stores/chatStore'

/**
 * Metis Self-Improvement: Analyze own codebase and suggest improvements.
 */
export async function triggerSelfImprovement(): Promise<void> {
  const profileStore = useProfileStore.getState()
  const projectStore = useProjectStore.getState()
  const chatStore = useChatStore.getState()

  // Find CodeHive project in project list, or use current project
  const codehiveProject = projectStore.projects.find(
    (p) => p.name.toLowerCase().includes('codehive') || p.path.includes('CodeHive')
  )

  if (!codehiveProject) {
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: 'Metis kann sich nicht selbst verbessern — CodeHive-Projekt nicht in der Projektliste gefunden. Füge das CodeHive-Verzeichnis als Projekt hinzu.',
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Build self-improvement prompt based on profile data
  const profile = profileStore.profile
  const feedbackContext = profile.feedbackNotes.length > 0
    ? `\nUser-Feedback aus vergangenen Runs:\n${profile.feedbackNotes.slice(-5).map((n) => `- ${n}`).join('\n')}`
    : ''

  const prompt = `Du bist Metis und analysierst deinen eigenen Quellcode (CodeHive).
Dein Ziel: Finde konkrete Verbesserungsmöglichkeiten und schlage sie vor.

Fokus-Bereiche:
1. UX-Verbesserungen die der User direkt spürt
2. Performance-Optimierungen
3. Fehlende Features die sinnvoll wären
4. Code-Qualität und Wartbarkeit
5. Bekannte Bugs oder Edge Cases

Statistiken:
- ${profile.totalRuns} Runs bisher, Erfolgsrate: ${Math.round((profile.positiveRuns / Math.max(profile.positiveRuns + profile.negativeRuns, 1)) * 100)}%
- Häufigste Aufgaben: ${Object.entries(profile.taskTypeFrequency).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k, v]) => `${k}(${v}x)`).join(', ') || 'keine'}
${feedbackContext}

Erstelle einen konkreten Verbesserungsplan mit priorisierten Tasks.`

  // Reset self-improve counter
  profileStore.recordRun('self-improvement', ['architect'], true)
  useProfileStore.setState((s) => ({
    profile: { ...s.profile, runsSinceLastSelfImprove: 0 },
  }))

  await orchestrate(prompt, codehiveProject)
}

/**
 * Check if self-improvement should be suggested.
 */
export function shouldSuggestSelfImprovement(): boolean {
  const { profile } = useProfileStore.getState()
  return profile.runsSinceLastSelfImprove >= 5
}
