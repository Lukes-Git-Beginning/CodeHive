import { useProfileStore } from '../stores/profileStore'
import { useProjectStore } from '../stores/projectStore'
import { useNotificationStore } from '../stores/notificationStore'
import { orchestrate } from './orchestrator'
import { useChatStore } from '../stores/chatStore'

/**
 * Metis Self-Improvement: Analyze own codebase and suggest improvements.
 */
export async function triggerSelfImprovement(): Promise<void> {
  const profileStore = useProfileStore.getState()
  const projectStore = useProjectStore.getState()
  const chatStore = useChatStore.getState()
  const notify = useNotificationStore.getState().addNotification

  // Find CodeHive/Metis project, or fall back to active project
  const codehiveProject = projectStore.projects.find(
    (p) => p.name.toLowerCase().includes('codehive') || p.name.toLowerCase().includes('metis') || p.path.includes('CodeHive')
  ) || projectStore.getActiveProject()

  if (!codehiveProject) {
    notify('error', 'Selbstverbesserung fehlgeschlagen — kein Projekt gefunden.')
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: 'Metis kann sich nicht selbst verbessern — kein Projekt gefunden. Füge das CodeHive-Verzeichnis als Projekt hinzu.',
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Build enriched self-improvement prompt
  const profile = profileStore.profile
  const successRate = Math.round((profile.positiveRuns / Math.max(profile.positiveRuns + profile.negativeRuns, 1)) * 100)
  const topTasks = Object.entries(profile.taskTypeFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v}x)`)
    .join(', ')
  const feedbackContext = profile.feedbackNotes.length > 0
    ? `\nUser-Feedback aus vergangenen Runs:\n${profile.feedbackNotes.slice(-5).map((n) => `- ${n}`).join('\n')}`
    : ''

  const prompt = `Du analysierst den Quellcode von METIS (CodeHive) — dem selbstlernenden AI-Assistenten, in dem du gerade läufst. Das ist eine Selbstverbesserung: du verbesserst dich selbst.

WICHTIG: Schlage NUR konkrete Code-Änderungen vor. Keine theoretischen Tipps. Zeige exakte Diffs oder neue Dateien.

Projekt: ${codehiveProject.name} (${codehiveProject.path})
Tech-Stack: ${codehiveProject.techStack.join(', ')}

User-Profil:
- ${profile.totalRuns} Runs, Erfolgsrate: ${successRate}%
- Bevorzugter Modus: ${profile.preferredMode}
- Häufigste Aufgaben: ${topTasks || 'noch keine'}
- Runs seit letzter Selbstverbesserung: ${profile.runsSinceLastSelfImprove}
${feedbackContext}

Fokus-Bereiche (priorisiert):
1. UX-Verbesserungen die der User direkt spürt
2. Bugs oder Edge Cases die du im Code findest
3. Performance-Optimierungen (Bundle-Größe, Re-Renders, DB-Queries)
4. Fehlende Features die basierend auf dem User-Profil sinnvoll wären
5. Code-Qualität (Duplikation, tote Pfade, fehlende Error-Handler)

Erstelle einen priorisierten Plan mit konkreten Code-Änderungen.`

  notify('info', 'Metis Selbstverbesserung gestartet...')

  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: `[Selbstverbesserung] Metis analysiert den eigenen Quellcode (${profile.totalRuns} Runs, ${successRate}% Erfolgsrate)`,
    timestamp: new Date().toISOString(),
  })
  chatStore.setProcessing(true)

  try {
    await orchestrate(prompt, codehiveProject)

    // Only reset counter after successful run
    profileStore.recordRun('self-improvement', ['architect'], true)
    useProfileStore.setState((s) => ({
      profile: { ...s.profile, runsSinceLastSelfImprove: 0 },
    }))

    notify('success', 'Selbstverbesserung abgeschlossen — prüfe die Vorschläge im Chat.')
  } catch (err) {
    notify('error', `Selbstverbesserung fehlgeschlagen: ${err}`)
    chatStore.addMessage({
      id: crypto.randomUUID(),
      role: 'system',
      content: `Selbstverbesserung fehlgeschlagen: ${err}`,
      timestamp: new Date().toISOString(),
    })
    chatStore.setProcessing(false)
  }
}

/**
 * Check if self-improvement should be suggested.
 */
export function shouldSuggestSelfImprovement(): boolean {
  const { profile } = useProfileStore.getState()
  return profile.runsSinceLastSelfImprove >= 5
}
