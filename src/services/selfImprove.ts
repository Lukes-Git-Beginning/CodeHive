import { useProfileStore } from '../stores/profileStore'
import { useProjectStore } from '../stores/projectStore'
import { useNotificationStore } from '../stores/notificationStore'
import { orchestrate } from './orchestrator'
import { useChatStore } from '../stores/chatStore'
import { scanCodebase } from './codebaseScanner'
import { gatherMetrics } from './codeMetrics'

/**
 * Metis Self-Improvement: Systematically analyze own codebase and apply improvements.
 */
export async function triggerSelfImprovement(depth: 'quick' | 'full' = 'full'): Promise<void> {
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

  // Build enriched context
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

  notify('info', `Metis Selbstverbesserung gestartet (${depth === 'full' ? 'Vollständig' : 'Schnell'})...`)

  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'user',
    content: `[Selbstverbesserung — ${depth}] Metis analysiert den eigenen Quellcode (${profile.totalRuns} Runs, ${successRate}% Erfolgsrate)`,
    timestamp: new Date().toISOString(),
  })
  chatStore.setProcessing(true)

  // Phase 0: Pre-Scan
  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'orchestrator',
    content: 'Phase 0: Codebase-Scan und Metriken werden erfasst...',
    timestamp: new Date().toISOString(),
  })

  const [scanResult, metrics] = await Promise.all([
    scanCodebase(codehiveProject.path),
    gatherMetrics(codehiveProject.path),
  ])

  chatStore.addMessage({
    id: crypto.randomUUID(),
    role: 'orchestrator',
    content: `Scan abgeschlossen: ${scanResult.totalFiles} Dateien gefunden, ${metrics.recentlyChanged.length} kürzlich geändert.`,
    timestamp: new Date().toISOString(),
  })

  // Build module lists for prompt
  const servicesList = (scanResult.modulesByType['service'] || []).map(m => m.path).join('\n  ')
  const storesList = (scanResult.modulesByType['store'] || []).map(m => m.path).join('\n  ')
  const componentsList = (scanResult.modulesByType['component'] || []).map(m => m.path).join('\n  ')
  const rustList = (scanResult.modulesByType['rust'] || []).map(m => m.path).join('\n  ')

  const recentlyChangedInfo = metrics.recentlyChanged.length > 0
    ? `\nKürzlich geänderte Dateien (höhere Priorität):\n${metrics.recentlyChanged.map(f => `  - ${f}`).join('\n')}`
    : ''

  // Build the structured prompt
  const prompt = depth === 'quick'
    ? `Du analysierst den Quellcode von METIS (CodeHive) — dem selbstlernenden AI-Assistenten. QUICK-SCAN: Fokussiere nur auf kürzlich geänderte Dateien.

Projekt: ${codehiveProject.name} (${codehiveProject.path})
Tech-Stack: ${codehiveProject.techStack.join(', ')}

User-Profil: ${profile.totalRuns} Runs, Erfolgsrate: ${successRate}%, Modus: ${profile.preferredMode}
${feedbackContext}
${recentlyChangedInfo}

Prüfe diese Dateien auf:
- Bugs oder Edge Cases
- Fehlende Error-Handler
- UX-Probleme
- Performance-Issues

Erstelle konkrete Code-Änderungen mit exakten Diffs.`
    : `Du analysierst den Quellcode von METIS (CodeHive) systematisch, Modul für Modul. Das ist eine Selbstverbesserung: du verbesserst dich selbst.

WICHTIG: Schlage NUR konkrete Code-Änderungen vor. Keine theoretischen Tipps. Zeige exakte Diffs oder neue Dateien.

Projekt: ${codehiveProject.name} (${codehiveProject.path})
Tech-Stack: ${codehiveProject.techStack.join(', ')}

User-Profil:
- ${profile.totalRuns} Runs, Erfolgsrate: ${successRate}%
- Bevorzugter Modus: ${profile.preferredMode}
- Häufigste Aufgaben: ${topTasks || 'noch keine'}
- Runs seit letzter Selbstverbesserung: ${profile.runsSinceLastSelfImprove}
${feedbackContext}

CODEBASE-ÜBERSICHT: ${scanResult.totalFiles} Dateien
${recentlyChangedInfo}

ANALYSE-REIHENFOLGE (systematisch):

1. SERVICES (${(scanResult.modulesByType['service'] || []).length} Dateien):
  ${servicesList}
  → Prüfe: Error Handling, Edge Cases, Performance, fehlende Validierung

2. STORES (${(scanResult.modulesByType['store'] || []).length} Dateien):
  ${storesList}
  → Prüfe: State-Konsistenz, fehlende Cleanup, unnötige Re-Renders

3. COMPONENTS (${(scanResult.modulesByType['component'] || []).length} Dateien):
  ${componentsList}
  → Prüfe: UX-Bugs, Accessibility, fehlende Loading/Error States

4. RUST BACKEND (${(scanResult.modulesByType['rust'] || []).length} Dateien):
  ${rustList}
  → Prüfe: Error Handling, SQL-Injection, Resource Leaks, Panics

5. TYPES & CONFIG:
  → Prüfe: Typ-Konsistenz, fehlende Felder, veraltete Config

PRIORISIERUNG:
- P0: Crashes, Daten-Verlust, Security-Lücken
- P1: UX-Bugs die der User direkt spürt
- P2: Performance (Re-Renders, Bundle-Größe, DB-Queries)
- P3: Code-Qualität (Duplikation, tote Pfade, fehlende Error-Handler)
- P4: Neue Features basierend auf User-Profil

Beginne mit den kürzlich geänderten Dateien (höhere Wahrscheinlichkeit für frische Bugs).
Erstelle einen priorisierten Plan mit konkreten Code-Änderungen.`

  try {
    await orchestrate(prompt, codehiveProject)

    // Only reset counter after successful run (recordRun is called by orchestrate internally)
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
  } finally {
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
