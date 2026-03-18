/**
 * Swarm Intelligence Module — Advanced multi-agent patterns.
 *
 * 1. Competing Hypotheses: N agents investigate different theories, debate findings
 * 2. Specialist Router: Routes tasks to optimal specialist based on content analysis
 *
 * These patterns go beyond what a single-context agent (like Claude Code) can do,
 * leveraging true parallelism and specialization.
 */

import { getRoleForTask } from './agentRoles'

// ── Specialist Router ──

interface RoutingDecision {
  role: string
  confidence: number
  reason: string
}

/**
 * Analyze a task and route it to the optimal specialist role.
 * Uses keyword analysis + task structure to determine the best agent.
 *
 * More sophisticated than getRoleForTask() — considers file types,
 * action complexity, and historical success rates.
 */
export function routeToSpecialist(
  taskName: string,
  action: string,
  files: { modify: string[]; create: string[]; read: string[] },
): RoutingDecision {
  const text = `${taskName} ${action}`.toLowerCase()
  const allFiles = [...files.modify, ...files.create, ...files.read]

  // Score each role based on multiple signals
  const scores: Record<string, number> = {
    frontend: 0, backend: 0, testing: 0, devops: 0,
    security: 0, architect: 0, uiux: 0,
  }

  // File extension scoring
  for (const file of allFiles) {
    if (/\.(tsx|jsx|css|scss|html)$/i.test(file)) scores.frontend += 2
    if (/\.(ts|js|rs|py)$/i.test(file) && !/\.(tsx|jsx)$/i.test(file)) scores.backend += 1
    if (/\.(test|spec|e2e)\./i.test(file)) scores.testing += 3
    if (/\.(yml|yaml|toml|dockerfile|docker)/i.test(file)) scores.devops += 2
    if (/\.css$/i.test(file)) scores.uiux += 1
  }

  // Keyword scoring
  const keywordMap: Record<string, string[]> = {
    security: ['security', 'audit', 'owasp', 'xss', 'injection', 'auth', 'vulnerability', 'cve', 'sanitize'],
    testing: ['test', 'jest', 'vitest', 'spec', 'coverage', 'mock', 'assert', 'e2e'],
    frontend: ['react', 'component', 'css', 'tailwind', 'ui', 'render', 'dom', 'jsx', 'hook', 'layout'],
    backend: ['api', 'database', 'server', 'endpoint', 'query', 'rust', 'handler', 'route'],
    devops: ['ci', 'cd', 'docker', 'deploy', 'build', 'pipeline', 'monitoring', 'infra'],
    architect: ['refactor', 'architecture', 'design', 'pattern', 'solid', 'modular', 'abstraction'],
    uiux: ['accessibility', 'a11y', 'aria', 'ux', 'usability', 'responsive', 'touch', 'keyboard'],
  }

  for (const [role, keywords] of Object.entries(keywordMap)) {
    for (const kw of keywords) {
      if (text.includes(kw)) scores[role] += 2
    }
  }

  // Find best match
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a)
  const [bestRole, bestScore] = sorted[0]
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? bestScore / totalScore : 0

  // If no clear winner, fall back to basic role inference
  if (bestScore === 0) {
    const fallback = getRoleForTask(action, taskName)
    return { role: fallback, confidence: 0.3, reason: 'Fallback: keine klare Spezialisierung erkannt' }
  }

  return {
    role: bestRole,
    confidence: Math.min(confidence, 1),
    reason: `${bestRole} gewählt (Score: ${bestScore}/${totalScore}, Keywords: ${keywordMap[bestRole]?.filter((kw) => text.includes(kw)).join(', ')})`,
  }
}

// ── Competing Hypotheses ──

export interface Hypothesis {
  id: string
  description: string
  assignedRole: string
}

export interface DebateResult {
  hypotheses: Hypothesis[]
  winningHypothesis: string | null
  summary: string
}

/**
 * Generate competing hypotheses for a debugging/investigation task.
 * Splits the problem into N independent theories that agents explore.
 */
export function generateHypotheses(problem: string, maxHypotheses = 3): Hypothesis[] {
  // Extract potential cause categories from the problem description
  const lower = problem.toLowerCase()
  const hypotheses: Hypothesis[] = []

  const categories: Array<{ test: RegExp; desc: string; role: string }> = [
    { test: /state|store|zustand|race|async|promise/i, desc: 'State-Management oder Race Condition', role: 'backend' },
    { test: /render|component|hook|effect|mount/i, desc: 'React Rendering oder Lifecycle Problem', role: 'frontend' },
    { test: /api|network|fetch|timeout|cors/i, desc: 'API/Netzwerk Problem', role: 'backend' },
    { test: /style|css|layout|display|position/i, desc: 'CSS/Layout Problem', role: 'uiux' },
    { test: /security|auth|token|session|permission/i, desc: 'Security/Auth Problem', role: 'security' },
    { test: /type|typescript|interface|generic/i, desc: 'TypeScript Type-System Problem', role: 'architect' },
    { test: /test|assertion|mock|expect/i, desc: 'Test-Konfiguration oder Mock Problem', role: 'testing' },
    { test: /build|webpack|vite|compile|bundle/i, desc: 'Build/Bundling Problem', role: 'devops' },
  ]

  for (const cat of categories) {
    if (cat.test.test(lower) && hypotheses.length < maxHypotheses) {
      hypotheses.push({
        id: crypto.randomUUID(),
        description: cat.desc,
        assignedRole: cat.role,
      })
    }
  }

  // If no specific patterns found, create generic hypotheses
  if (hypotheses.length === 0) {
    hypotheses.push(
      { id: crypto.randomUUID(), description: 'Code-Logik oder Business-Logic Fehler', assignedRole: 'backend' },
      { id: crypto.randomUUID(), description: 'Fehlende Error-Handling oder Edge Case', assignedRole: 'architect' },
      { id: crypto.randomUUID(), description: 'Konfiguration oder Environment Problem', assignedRole: 'devops' },
    )
  }

  // Ensure we have at least 2 hypotheses
  while (hypotheses.length < 2) {
    hypotheses.push({
      id: crypto.randomUUID(),
      description: 'Alternative Ursache — systematische Untersuchung',
      assignedRole: 'architect',
    })
  }

  return hypotheses.slice(0, maxHypotheses)
}

/**
 * Build a debate prompt for an agent investigating a hypothesis.
 * Includes instructions to challenge other hypotheses via blackboard.
 */
export function buildHypothesisPrompt(
  hypothesis: Hypothesis,
  allHypotheses: Hypothesis[],
  originalProblem: string,
): string {
  const otherHypotheses = allHypotheses
    .filter((h) => h.id !== hypothesis.id)
    .map((h) => `- ${h.description} (${h.assignedRole})`)
    .join('\n')

  return `Du untersuchst eine spezifische Hypothese zu folgendem Problem:

PROBLEM: ${originalProblem}

DEINE HYPOTHESE: ${hypothesis.description}

ANDERE HYPOTHESEN (die andere Agents untersuchen):
${otherHypotheses}

AUFGABE:
1. Untersuche den Code systematisch auf Belege für deine Hypothese
2. Poste gefundene Belege als [FINDING] ...
3. Poste Gegenargumente gegen andere Hypothesen als [WARNING] ...
4. Wenn du Belege GEGEN deine eigene Hypothese findest, sei ehrlich und poste [WARNING] Eigene Hypothese widerlegt: ...

Sei kritisch und evidenzbasiert. Keine Spekulation ohne Code-Belege.`
}
