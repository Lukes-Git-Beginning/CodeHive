/**
 * Deep Scan Service — Systematische Projekt-Analyse in 6 Phasen.
 *
 * Pipeline: Inventory → Categorize → Graph → Quick Scan → Deep Analysis (Agent) → Store
 * Alle Ergebnisse landen in der Knowledge Base (FTS5-durchsuchbar).
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Project } from '../types/project'
import { useDeepScanStore, type DeepScanProgress, type DeepScanResult } from '../stores/deepScanStore'
import { useAgentStore } from '../stores/agentStore'
import { scanCodebase } from './codebaseScanner'
import { buildCodeGraph, getGraphStats, findDeadCode } from './codeGraph'
import { quickScan } from './autoScan'
import { readClaudeMd } from './rag'
import { ROLE_PROMPTS, AGENT_SAFETY_RULES } from './agentRoles'
import { getSetting } from './persistence'

// ── Types ──

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

interface KnowledgeEntry {
  id: string
  project_id: string
  key: string
  value: string
  source_agent: string
  created_at: string
}

// ── Helpers ──

function flattenFileTree(entries: FileEntry[], prefix = ''): string[] {
  const paths: string[] = []
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.is_dir) {
      paths.push(...flattenFileTree(entry.children, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

function updateProgress(phase: DeepScanProgress['phase'], label: string, progress: number, details?: string) {
  const store = useDeepScanStore.getState()
  store.updateProgress({
    phase,
    phaseLabel: label,
    progress,
    details,
    startedAt: store.progress?.startedAt || new Date().toISOString(),
  })
}

function isCancelled(): boolean {
  return useDeepScanStore.getState().cancelled
}

// ── Main Pipeline ──

export async function runDeepScan(project: Project): Promise<DeepScanResult | null> {
  const store = useDeepScanStore.getState()
  if (store.isScanning) throw new Error('Scan already in progress')

  store.startScan(project.id)
  const startTime = Date.now()

  const projectPath = project.path.trim()
  let techStack: string[] = []
  let fileStats = { total: 0, byType: {} as Record<string, number> }
  let graphStats = { nodes: 0, edges: 0, topConnected: [] as string[] }
  let quickScanResults: Array<{ type: string; title: string; detail: string }> = []
  let agentAnalysis = ''
  let storedEntries = 0
  let fileSummary = ''

  try {
    // ── Phase 1: Inventory ──
    if (isCancelled()) return null
    updateProgress('inventory', 'Inventar erstellen...', 5, 'Tech Stack und Dateibaum werden erfasst')

    techStack = await invoke<string[]>('detect_tech_stack', { path: projectPath })
    const fileTree = await invoke<FileEntry[]>('list_project_files', {
      path: projectPath,
      maxDepth: 4,
    })
    const allFiles = flattenFileTree(fileTree)

    updateProgress('inventory', 'Inventar erstellen...', 15, `${allFiles.length} Dateien gefunden`)

    // ── Phase 2: Categorize ──
    if (isCancelled()) return null
    updateProgress('categorize', 'Dateien kategorisieren...', 20, `${allFiles.length} Dateien werden sortiert`)

    const scanResult = await scanCodebase(projectPath)
    fileStats = {
      total: scanResult.totalFiles,
      byType: Object.fromEntries(
        Object.entries(scanResult.modulesByType).map(([type, mods]) => [type, mods.length])
      ),
    }
    fileSummary = scanResult.summary.slice(0, 2000)

    updateProgress('categorize', 'Dateien kategorisieren...', 30, `${scanResult.totalFiles} Code-Dateien kategorisiert`)

    // ── Phase 3: Knowledge Graph ──
    if (isCancelled()) return null
    updateProgress('graph', 'Knowledge Graph aufbauen...', 35, 'Code-Beziehungen werden analysiert')

    try {
      await buildCodeGraph(project.id, projectPath)
    } catch (err) {
      console.warn('Code graph build failed (non-fatal):', err)
    }
    const stats = getGraphStats()
    const deadCode = findDeadCode()
    graphStats = {
      nodes: stats.totalNodes,
      edges: stats.totalEdges,
      topConnected: stats.topConnected.slice(0, 5).map((n: { name: string; connections: number }) => n.name),
    }

    updateProgress('graph', 'Knowledge Graph aufbauen...', 50, `${stats.totalNodes} Nodes, ${stats.totalEdges} Edges`)

    // ── Phase 4: Quick Scan ──
    if (isCancelled()) return null
    updateProgress('quick_scan', 'Quick Scan...', 55, 'Projekt-Health wird geprüft')

    const qsResults = await quickScan(project)
    quickScanResults = qsResults.map((r) => ({ type: r.type, title: r.title, detail: r.detail }))

    updateProgress('quick_scan', 'Quick Scan...', 60, `${qsResults.length} Findings`)

    // ── Phase 5: Deep Analysis (Agent) ──
    if (isCancelled()) return null
    updateProgress('deep_analysis', 'KI-Analyse läuft...', 65, 'Claude analysiert das Projekt')

    const claudeMd = await readClaudeMd(projectPath)

    const analysisPrompt = buildAnalysisPrompt(project, techStack, fileSummary, graphStats, deadCode, quickScanResults, claudeMd)
    agentAnalysis = await spawnAnalysisAgent(project, analysisPrompt)

    updateProgress('deep_analysis', 'KI-Analyse läuft...', 90, 'Analyse abgeschlossen')

    // ── Phase 6: Store ──
    if (isCancelled()) return null
    updateProgress('storing', 'Ergebnisse speichern...', 92, 'Findings werden in Knowledge Base geschrieben')

    storedEntries = await storeFindings(project, techStack, fileStats, graphStats, quickScanResults, agentAnalysis, deadCode)

    updateProgress('storing', 'Ergebnisse speichern...', 100, `${storedEntries} Einträge gespeichert`)

    // ── Done ──
    const result: DeepScanResult = {
      projectId: project.id,
      projectName: project.name,
      techStack,
      fileStats,
      graphStats,
      quickScanResults,
      agentAnalysis,
      storedEntries,
      duration: Date.now() - startTime,
      scannedAt: new Date().toISOString(),
    }

    store.finishScan(result)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    store.failScan(message)
    return null
  }
}

// ── Agent Spawn ──

function buildAnalysisPrompt(
  project: Project,
  techStack: string[],
  fileSummary: string,
  graphStats: { nodes: number; edges: number; topConnected: string[] },
  deadCode: Array<{ name: string; filePath: string }>,
  quickScanResults: Array<{ type: string; title: string; detail: string }>,
  claudeMd: string | null
): string {
  const sections = [
    `# Projekt-Analyse: ${project.name}`,
    `Pfad: ${project.path}`,
    `Tech Stack: ${techStack.join(', ') || 'unbekannt'}`,
    '',
    '## Dateistruktur (Auszug)',
    fileSummary,
    '',
    `## Code Graph: ${graphStats.nodes} Nodes, ${graphStats.edges} Edges`,
    `Top Connected: ${graphStats.topConnected.join(', ')}`,
    deadCode.length > 0 ? `Dead Code Candidates: ${deadCode.slice(0, 10).map((d) => d.name).join(', ')}` : '',
    '',
    '## Quick Scan Findings',
    quickScanResults.map((r) => `- [${r.type}] ${r.title}: ${r.detail}`).join('\n'),
    '',
    claudeMd ? `## CLAUDE.md\n${claudeMd.slice(0, 2000)}` : '',
    '',
    '## Deine Aufgabe',
    'Analysiere dieses Projekt gründlich. Lies die wichtigsten Dateien und antworte mit einem JSON-Objekt:',
    '',
    '```json',
    '{',
    '  "architecture": "Beschreibung der Architektur, Layers, Patterns, Datenfluss",',
    '  "entry_points": "Haupt-Einstiegspunkte, Routing, CLI Entry",',
    '  "dependencies": "Wichtige externe Dependencies und interne Kopplungen",',
    '  "code_quality": "Beobachtungen zu Code-Qualität, Patterns, Anti-Patterns, Test Coverage",',
    '  "features": "Was macht die App? Feature-Inventar",',
    '  "improvements": "Top 5 konkrete Verbesserungsvorschläge"',
    '}',
    '```',
    '',
    'Antworte NUR mit dem JSON-Objekt. Keine Erklärungen davor oder danach.',
  ]

  return sections.filter(Boolean).join('\n')
}

async function spawnAnalysisAgent(project: Project, prompt: string): Promise<string> {
  const agentId = `deepscan-${project.id}-${Date.now()}`
  const agentStore = useAgentStore.getState()

  const systemPrompt = `${ROLE_PROMPTS.analyst}\n\n${AGENT_SAFETY_RULES}`

  // Add agent to store for output tracking
  agentStore.addAgent({
    id: agentId,
    role: 'analyst',
    status: 'working',
    currentTask: `Deep Scan: ${project.name}`,
    output: [],
    filesChanged: [],
    startedAt: new Date().toISOString(),
  })

  // Setup output collection
  const outputLines: string[] = []

  const outputUnlisten = await listen<{ agent_id: string; line: string }>('agent-output', (event) => {
    if (event.payload.agent_id !== agentId) return
    const { line } = event.payload
    try {
      const parsed = JSON.parse(line)
      if (parsed.type === 'assistant' && parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === 'text') {
            outputLines.push(block.text)
            agentStore.appendAgentOutput(agentId, block.text)
          }
        }
      } else if (parsed.type === 'result' && parsed.result) {
        outputLines.push(parsed.result)
        agentStore.appendAgentOutput(agentId, parsed.result)
      }
    } catch {
      if (line.trim() && !line.startsWith('[stderr]')) {
        outputLines.push(line)
        agentStore.appendAgentOutput(agentId, line)
      }
    }
  })

  // Wait for completion
  const completionPromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      agentStore.updateAgent(agentId, { status: 'error', finishedAt: new Date().toISOString() })
      reject(new Error('Deep Scan Agent Timeout (10min)'))
    }, 10 * 60 * 1000)

    const statusListener = listen<{ agent_id: string; status: string }>('agent-status', (event) => {
      if (event.payload.agent_id !== agentId) return
      const { status } = event.payload
      agentStore.updateAgent(agentId, {
        status: status as 'done' | 'error',
        ...(status === 'done' || status === 'error' ? { finishedAt: new Date().toISOString() } : {}),
      })
      if (status === 'done' || status === 'error') {
        clearTimeout(timer)
        statusListener.then((unlisten) => unlisten())
        resolve(status)
      }
    })
  })

  // Spawn the agent — no permission mode (read-only)
  const autoAccept = await getSetting('auto_accept')
  const permissionMode = autoAccept === 'true' ? 'acceptEdits' : undefined

  await invoke('spawn_agent', {
    agentId,
    role: 'analyst',
    prompt,
    projectPath: project.path.trim(),
    systemPrompt,
    model: 'claude-sonnet-4-6',
    permissionMode,
    mcpConfigPath: undefined,
  })

  const status = await completionPromise
  outputUnlisten()

  if (status === 'error') {
    throw new Error('Analysis agent failed')
  }

  return outputLines.join('\n')
}

// ── Store Findings ──

async function storeFindings(
  project: Project,
  techStack: string[],
  fileStats: { total: number; byType: Record<string, number> },
  graphStats: { nodes: number; edges: number; topConnected: string[] },
  quickScanResults: Array<{ type: string; title: string; detail: string }>,
  agentAnalysis: string,
  deadCode: Array<{ name: string; filePath: string }>
): Promise<number> {
  let count = 0
  const now = new Date().toISOString()

  const saveEntry = async (key: string, value: string) => {
    const entry: KnowledgeEntry = {
      id: `deepscan-${key}-${project.id}`,
      project_id: project.id,
      key: `deepscan:${key}`,
      value,
      source_agent: 'deep-scan',
      created_at: now,
    }
    try {
      await invoke('db_save_knowledge', { entry })
      count++
    } catch (err) {
      console.error(`Failed to save deepscan:${key}:`, err)
    }
  }

  // Store inventory
  await saveEntry('inventory', JSON.stringify({
    techStack,
    fileStats,
    graphStats,
    deadCodeCount: deadCode.length,
    deadCodeSample: deadCode.slice(0, 10).map((d) => `${d.name} (${d.filePath})`),
    quickScanResults,
  }))

  // Parse and store agent analysis sections
  const parsed = parseAgentAnalysis(agentAnalysis)
  if (parsed) {
    if (parsed.architecture) await saveEntry('architecture', parsed.architecture)
    if (parsed.entry_points) await saveEntry('entry_points', parsed.entry_points)
    if (parsed.dependencies) await saveEntry('dependencies', parsed.dependencies)
    if (parsed.code_quality) await saveEntry('code_quality', parsed.code_quality)
    if (parsed.features) await saveEntry('features', parsed.features)
    if (parsed.improvements) await saveEntry('improvements', parsed.improvements)
  } else {
    // Fallback: store raw analysis
    await saveEntry('raw_analysis', agentAnalysis.slice(0, 10000))
  }

  // Update project brief
  const briefParts = [
    `Projekt: ${project.name}`,
    `Pfad: ${project.path}`,
    `Tech Stack: ${techStack.join(', ')}`,
    `${fileStats.total} Code-Dateien, ${graphStats.nodes} Graph Nodes`,
    parsed?.architecture ? `\nArchitektur: ${parsed.architecture.slice(0, 500)}` : '',
    parsed?.features ? `\nFeatures: ${parsed.features.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n')

  await saveEntry('brief', briefParts)

  // Also update the main project:brief
  const briefEntry: KnowledgeEntry = {
    id: `brief-${project.id}`,
    project_id: project.id,
    key: 'project:brief',
    value: briefParts,
    source_agent: 'deep-scan',
    created_at: now,
  }
  try {
    await invoke('db_save_knowledge', { entry: briefEntry })
  } catch { /* brief update optional */ }

  return count
}

function parseAgentAnalysis(raw: string): Record<string, string> | null {
  // Strategy 1: Pure JSON
  try {
    const trimmed = raw.trim()
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed)
    }
  } catch { /* not pure JSON */ }

  // Strategy 2: JSON in code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch { /* invalid */ }
  }

  // Strategy 3: Find outermost JSON object
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1))
    } catch { /* invalid */ }
  }

  return null
}
