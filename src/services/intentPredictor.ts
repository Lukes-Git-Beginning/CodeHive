/**
 * Predictive Intent Engine + Temporal Reasoning
 *
 * Analyzes patterns in user behavior, git activity, and run history
 * to predict what the user needs BEFORE they ask.
 *
 * Also provides temporal reasoning: understanding WHEN and WHY code changes,
 * detecting instability patterns, regression cycles, and work rhythms.
 */

import { invoke } from '@tauri-apps/api/core'
import type { Project } from '../types/project'
import { useProfileStore } from '../stores/profileStore'

// ── Prediction Types ──

export interface Prediction {
  id: string
  type: PredictionType
  title: string
  description: string
  confidence: number  // 0-1
  actionPrompt: string  // What Metis should do if accepted
  signals: string[]  // What data points led to this prediction
  category: 'security' | 'testing' | 'review' | 'refactor' | 'deploy' | 'learn'
}

export type PredictionType =
  | 'test_needed'       // User changed code but no tests
  | 'security_scan'     // Auth/security code changed
  | 'refactor_needed'   // High churn file
  | 'regression_risk'   // Same bug fixed multiple times
  | 'release_prep'      // Many features, probably nearing release
  | 'dependency_drift'  // Outdated dependencies
  | 'complexity_spike'  // Code complexity increasing
  | 'review_needed'     // Large changes without review

// ── Temporal Analysis ──

export interface FileChurnData {
  path: string
  changeCount: number
  lastChanged: string
  authors: string[]
  isHotspot: boolean  // Changed > 5x in 14 days
}

export interface TemporalInsight {
  type: 'hotspot' | 'regression' | 'velocity' | 'rhythm'
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  data: Record<string, unknown>
}

/**
 * Analyze git log to detect file churn hotspots.
 */
export async function analyzeFileChurn(projectPath: string): Promise<FileChurnData[]> {
  try {
    const commits = await invoke<Array<{
      message: string
      timestamp: string
      files?: string[]
    }>>('git_log', { path: projectPath })

    if (!Array.isArray(commits)) return []

    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000 // 14 days
    const fileChanges = new Map<string, { count: number; lastChanged: string }>()

    for (const commit of commits) {
      if (!commit.files || !commit.timestamp) continue
      const commitTime = new Date(commit.timestamp).getTime()
      if (commitTime < cutoff) continue

      for (const file of commit.files) {
        const existing = fileChanges.get(file)
        if (existing) {
          existing.count++
          if (commit.timestamp > existing.lastChanged) {
            existing.lastChanged = commit.timestamp
          }
        } else {
          fileChanges.set(file, { count: 1, lastChanged: commit.timestamp })
        }
      }
    }

    return [...fileChanges.entries()]
      .map(([path, data]) => ({
        path,
        changeCount: data.count,
        lastChanged: data.lastChanged,
        authors: [],
        isHotspot: data.count >= 5,
      }))
      .sort((a, b) => b.changeCount - a.changeCount)
  } catch {
    return []
  }
}

/**
 * Generate temporal insights from project data.
 */
export async function getTemporalInsights(projectPath: string): Promise<TemporalInsight[]> {
  const insights: TemporalInsight[] = []
  const churnData = await analyzeFileChurn(projectPath)

  // Detect hotspots
  const hotspots = churnData.filter((f) => f.isHotspot)
  if (hotspots.length > 0) {
    insights.push({
      type: 'hotspot',
      title: `${hotspots.length} instabile Dateien erkannt`,
      description: `${hotspots.map((h) => h.path).slice(0, 3).join(', ')} wurden je ${hotspots[0]?.changeCount}+ mal in 14 Tagen geändert`,
      severity: hotspots.length > 3 ? 'critical' : 'warning',
      data: { hotspots: hotspots.slice(0, 5).map((h) => ({ path: h.path, changes: h.changeCount })) },
    })
  }

  // Detect velocity changes
  const profile = useProfileStore.getState().profile
  if (profile.totalRuns > 10) {
    const recent = profile.totalRuns
    insights.push({
      type: 'velocity',
      title: 'Projekt-Aktivität',
      description: `${recent} Runs bisher, Erfolgsrate: ${Math.round((profile.positiveRuns / Math.max(1, profile.positiveRuns + profile.negativeRuns)) * 100)}%`,
      severity: 'info',
      data: { totalRuns: recent, successRate: profile.positiveRuns / Math.max(1, profile.positiveRuns + profile.negativeRuns) },
    })
  }

  return insights
}

// ── Prediction Engine ──

/**
 * Generate predictions based on current project state.
 * Each prediction has a confidence score — only surface predictions > threshold.
 */
export async function generatePredictions(
  project: Project,
  confidenceThreshold = 0.6,
): Promise<Prediction[]> {
  const predictions: Prediction[] = []
  const profile = useProfileStore.getState().profile

  // 1. Test needed — user changed code but hasn't run tests recently
  const testRuns = profile.taskTypeFrequency['test'] || 0
  const totalRuns = profile.totalRuns
  if (totalRuns > 3 && testRuns / totalRuns < 0.15) {
    predictions.push({
      id: 'pred-test-needed',
      type: 'test_needed',
      title: 'Tests könnten fällig sein',
      description: `Nur ${Math.round((testRuns / totalRuns) * 100)}% deiner Runs waren Tests. Code-Änderungen ohne Tests erhöhen das Regressions-Risiko.`,
      confidence: 0.75,
      actionPrompt: 'Analysiere die zuletzt geänderten Dateien und generiere Tests dafür. Fokus auf Edge Cases und Error Handling.',
      signals: [`Test-Anteil: ${testRuns}/${totalRuns} Runs`],
      category: 'testing',
    })
  }

  // 2. Security scan — if auth/security code was touched but no security audit
  const securityRuns = profile.taskTypeFrequency['security'] || 0
  if (totalRuns > 5 && securityRuns === 0) {
    predictions.push({
      id: 'pred-security',
      type: 'security_scan',
      title: 'Security-Audit empfohlen',
      description: 'Es wurde noch nie ein Security-Audit durchgeführt.',
      confidence: 0.7,
      actionPrompt: 'Führe einen Security-Audit durch. Prüfe OWASP Top 10, Input-Validierung, Auth-Flow.',
      signals: ['Keine Security-Runs bisher'],
      category: 'security',
    })
  }

  // 3. Review needed — many runs without review
  const reviewRuns = profile.taskTypeFrequency['review'] || 0
  if (totalRuns > 10 && reviewRuns / totalRuns < 0.1) {
    predictions.push({
      id: 'pred-review',
      type: 'review_needed',
      title: 'Code-Review vorschlagen',
      description: 'Viele Änderungen ohne systematisches Review.',
      confidence: 0.65,
      actionPrompt: 'Führe ein Code-Review der letzten Änderungen durch. Fokus auf Code-Qualität, Performance und Patterns.',
      signals: [`Review-Anteil: ${reviewRuns}/${totalRuns}`],
      category: 'review',
    })
  }

  // 4. Refactoring — churn analysis
  try {
    const churnData = await analyzeFileChurn(project.path)
    const hotspots = churnData.filter((f) => f.isHotspot)
    if (hotspots.length > 0) {
      predictions.push({
        id: 'pred-refactor',
        type: 'refactor_needed',
        title: 'Refactoring-Kandidaten erkannt',
        description: `${hotspots.length} Dateien werden häufig geändert — könnte auf Design-Probleme hindeuten.`,
        confidence: Math.min(0.5 + hotspots.length * 0.1, 0.9),
        actionPrompt: `Analysiere diese häufig geänderten Dateien auf Refactoring-Bedarf: ${hotspots.slice(0, 5).map((h) => h.path).join(', ')}`,
        signals: hotspots.slice(0, 3).map((h) => `${h.path}: ${h.changeCount}x geändert`),
        category: 'refactor',
      })
    }
  } catch { /* git analysis failed */ }

  // 5. Complexity spike — many runs with increasing agent count
  if (profile.totalRuns > 20) {
    const complexityScore = Object.values(profile.taskTypeFrequency).reduce((a, b) => a + b, 0)
    if (complexityScore > 30) {
      predictions.push({
        id: 'pred-complexity',
        type: 'complexity_spike',
        title: 'Projekt-Komplexität steigt',
        description: 'Die Aufgaben werden komplexer. Architektur-Review könnte helfen.',
        confidence: 0.6,
        actionPrompt: 'Analysiere die Projekt-Architektur und schlage Vereinfachungen vor. Fokus auf Modularisierung und klare Grenzen.',
        signals: [`${complexityScore} Aufgaben in ${Object.keys(profile.taskTypeFrequency).length} Kategorien`],
        category: 'review',
      })
    }
  }

  return predictions.filter((p) => p.confidence >= confidenceThreshold)
}

/**
 * Format predictions for ProactiveSuggestions component.
 * Returns suggestions compatible with the existing suggestion system.
 */
export function formatPredictionsForUI(predictions: Prediction[]): Array<{
  id: string
  text: string
  actionPayload: string
  category: string
  confidence: number
}> {
  return predictions.map((p) => ({
    id: p.id,
    text: `${p.title} (${Math.round(p.confidence * 100)}%)`,
    actionPayload: p.actionPrompt,
    category: p.category,
    confidence: p.confidence,
  }))
}
