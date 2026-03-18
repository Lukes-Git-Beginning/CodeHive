/**
 * Meta-Agent — Recursive Self-Improvement for Metis.
 *
 * The Meta-Agent analyzes Metis' own performance metrics and generates
 * improvements to system prompts, model routing, and orchestration parameters.
 *
 * Inspired by the Darwin Gödel Machine (Sakana AI) and SICA (arXiv 2504.15228).
 *
 * Safety mechanisms:
 * - Only modifies prompts and config, NOT code files
 * - All changes versioned with rollback capability
 * - 5-run validation before permanent adoption
 * - Transparent lineage of every modification
 */

import { getSetting, setSetting } from './persistence'
import { useProfileStore } from '../stores/profileStore'

// ── Types ──

export interface PerformanceMetrics {
  totalRuns: number
  successRate: number
  avgDuration: number  // seconds
  avgAgentCount: number
  failureReasons: Record<string, number>
  rolePerformance: Record<string, { success: number; fail: number; avgDuration: number }>
}

export interface EvolutionEntry {
  id: string
  timestamp: string
  target: string  // What was modified (e.g., 'prompt:security', 'config:timeout')
  before: string
  after: string
  reason: string
  validated: boolean
  validationRuns: number
  performanceDelta: number  // positive = improvement
}

export interface AgentGenome {
  role: string
  systemPromptOverride: string | null  // null = use default
  preferredModel: string
  timeout: number
  contextBudget: number
  successRate: number
  totalRuns: number
  lastEvolution: string | null
}

// ── Utility Function ──

/**
 * Calculate composite utility score for a run.
 * U = 0.5 × success + 0.25 × (1 - cost_ratio) + 0.25 × (1 - time_ratio)
 */
export function calculateUtility(
  success: boolean,
  durationSeconds: number,
  agentCount: number,
  maxDurationSeconds = 600,
  maxAgents = 10,
): number {
  const successScore = success ? 1 : 0
  const timeRatio = Math.min(durationSeconds / maxDurationSeconds, 1)
  const costRatio = Math.min(agentCount / maxAgents, 1)
  return 0.5 * successScore + 0.25 * (1 - costRatio) + 0.25 * (1 - timeRatio)
}

// ── Genome Management ──

const GENOME_STORAGE_KEY = 'metis_agent_genomes'

/**
 * Load agent genomes from persistent storage.
 */
export async function loadGenomes(): Promise<AgentGenome[]> {
  try {
    const saved = await getSetting(GENOME_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* no genomes yet */ }

  // Initialize default genomes
  return getDefaultGenomes()
}

/**
 * Save agent genomes to persistent storage.
 */
export async function saveGenomes(genomes: AgentGenome[]): Promise<void> {
  await setSetting(GENOME_STORAGE_KEY, JSON.stringify(genomes))
}

/**
 * Get default genomes for all roles.
 */
function getDefaultGenomes(): AgentGenome[] {
  const roles = ['frontend', 'backend', 'testing', 'devops', 'security', 'architect', 'uiux', 'orchestrator']
  return roles.map((role) => ({
    role,
    systemPromptOverride: null,
    preferredModel: role === 'orchestrator' ? 'opus' : 'sonnet',
    timeout: 15 * 60 * 1000,
    contextBudget: 8000,
    successRate: 0,
    totalRuns: 0,
    lastEvolution: null,
  }))
}

/**
 * Update a genome's metrics after a run.
 */
export async function updateGenomeMetrics(
  role: string,
  success: boolean,
  _durationMs: number,
): Promise<void> {
  const genomes = await loadGenomes()
  const genome = genomes.find((g) => g.role === role)
  if (!genome) return

  genome.totalRuns++
  // Running average for success rate
  genome.successRate = (genome.successRate * (genome.totalRuns - 1) + (success ? 1 : 0)) / genome.totalRuns

  await saveGenomes(genomes)
}

/**
 * Get the genome for a specific role.
 */
export async function getGenome(role: string): Promise<AgentGenome | null> {
  const genomes = await loadGenomes()
  return genomes.find((g) => g.role === role) || null
}

// ── Evolution Engine ──

const EVOLUTION_LOG_KEY = 'metis_evolution_log'
const EVOLUTION_THRESHOLD_RUNS = 20 // Evolve after every 20 runs

/**
 * Check if evolution should be triggered.
 */
export async function shouldEvolve(): Promise<boolean> {
  const profile = useProfileStore.getState().profile
  return profile.totalRuns > 0 && profile.totalRuns % EVOLUTION_THRESHOLD_RUNS === 0
}

/**
 * Analyze performance and suggest improvements.
 * Returns a structured analysis that the meta-agent can act on.
 */
export async function analyzePerformance(): Promise<{
  weakestRole: string | null
  suggestions: string[]
  metrics: PerformanceMetrics
}> {
  const genomes = await loadGenomes()
  const profile = useProfileStore.getState().profile

  // Find weakest performing role
  const rolesWithRuns = genomes.filter((g) => g.totalRuns >= 3)
  const weakest = rolesWithRuns.length > 0
    ? rolesWithRuns.reduce((min, g) => g.successRate < min.successRate ? g : min)
    : null

  const suggestions: string[] = []

  if (weakest && weakest.successRate < 0.7) {
    suggestions.push(`Rolle "${weakest.role}" hat nur ${Math.round(weakest.successRate * 100)}% Erfolgsrate — System-Prompt überarbeiten`)
  }

  const total = profile.positiveRuns + profile.negativeRuns
  const overallSuccess = total > 0 ? profile.positiveRuns / total : 0

  if (overallSuccess < 0.8) {
    suggestions.push(`Gesamterfolgsrate bei ${Math.round(overallSuccess * 100)}% — Verifier-Phase verstärken`)
  }

  if (profile.totalRuns > 50 && Object.keys(profile.taskTypeFrequency).length < 3) {
    suggestions.push('Wenig Aufgaben-Diversität — breiteres Skillset entwickeln')
  }

  const metrics: PerformanceMetrics = {
    totalRuns: profile.totalRuns,
    successRate: overallSuccess,
    avgDuration: 0,
    avgAgentCount: 0,
    failureReasons: {},
    rolePerformance: {},
  }

  for (const genome of genomes) {
    if (genome.totalRuns > 0) {
      metrics.rolePerformance[genome.role] = {
        success: Math.round(genome.successRate * genome.totalRuns),
        fail: Math.round((1 - genome.successRate) * genome.totalRuns),
        avgDuration: 0,
      }
    }
  }

  return {
    weakestRole: weakest?.role || null,
    suggestions,
    metrics,
  }
}

/**
 * Build a prompt for the meta-agent to suggest improvements.
 */
export function buildMetaAgentPrompt(analysis: Awaited<ReturnType<typeof analyzePerformance>>): string {
  const roleTable = Object.entries(analysis.metrics.rolePerformance)
    .map(([role, data]) => `  ${role}: ${data.success} Erfolge, ${data.fail} Fehler`)
    .join('\n')

  return `Du bist der Meta-Agent von Metis — ein System das sich selbst verbessert.

Aktuelle Performance:
- Gesamtruns: ${analysis.metrics.totalRuns}
- Erfolgsrate: ${Math.round(analysis.metrics.successRate * 100)}%
- Schwächste Rolle: ${analysis.weakestRole || 'keine'}

Performance pro Rolle:
${roleTable || '  Noch keine Daten'}

Vorschläge:
${analysis.suggestions.map((s) => `- ${s}`).join('\n') || '  Keine aktuell'}

Aufgabe: Analysiere die Performance und schlage konkrete Verbesserungen vor.
Antworte im JSON-Format:
{
  "improvements": [
    {
      "target": "prompt:ROLE_NAME" | "config:PARAM_NAME",
      "change": "Beschreibung der Änderung",
      "reasoning": "Warum diese Änderung helfen wird",
      "priority": 1-5
    }
  ]
}

Fokussiere auf die größten Hebel. Maximal 3 Verbesserungsvorschläge.`
}

/**
 * Log an evolution entry for transparency and rollback.
 */
export async function logEvolution(entry: EvolutionEntry): Promise<void> {
  try {
    const saved = await getSetting(EVOLUTION_LOG_KEY)
    const log: EvolutionEntry[] = saved ? JSON.parse(saved) : []
    log.unshift(entry) // newest first
    await setSetting(EVOLUTION_LOG_KEY, JSON.stringify(log.slice(0, 50))) // keep last 50
  } catch {
    // best-effort
  }
}

/**
 * Get evolution history.
 */
export async function getEvolutionLog(): Promise<EvolutionEntry[]> {
  try {
    const saved = await getSetting(EVOLUTION_LOG_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}
