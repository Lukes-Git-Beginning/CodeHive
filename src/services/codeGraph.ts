/**
 * Codebase Knowledge Graph — Semantic understanding of code structure.
 *
 * Builds a graph of code relationships: which functions call which,
 * which components use which stores, which files depend on which.
 *
 * This gives Metis agents STRUCTURAL understanding of code, not just text search.
 * Instead of "grep for useChatStore", agents can query:
 * "What components depend on chatStore and would break if setProcessing changes?"
 *
 * Graph is stored in-memory per project and rebuilt on demand.
 */

import { invoke } from '@tauri-apps/api/core'

// ── Node Types ──

export type NodeKind = 'file' | 'function' | 'component' | 'store' | 'type' | 'hook'

export interface GraphNode {
  id: string
  kind: NodeKind
  name: string
  filePath: string
  line?: number
  metadata?: Record<string, string>
}

// ── Edge Types ──

export type EdgeKind =
  | 'imports'        // File → File
  | 'calls'          // Function → Function
  | 'uses_store'     // Component → Store
  | 'uses_hook'      // Component → Hook
  | 'renders'        // Component → Component
  | 'exports'        // File → Function/Component/Type
  | 'depends_on'     // File → File (transitive)

export interface GraphEdge {
  source: string  // Node ID
  target: string  // Node ID
  kind: EdgeKind
}

// ── Graph Store ──

interface CodeGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  projectId: string
  builtAt: string
}

let currentGraph: CodeGraph | null = null

/**
 * Build the code graph for a project by analyzing file contents.
 * Uses regex-based analysis (no AST dependency needed).
 */
export async function buildCodeGraph(projectId: string, projectPath: string): Promise<CodeGraph> {
  const graph: CodeGraph = {
    nodes: new Map(),
    edges: [],
    projectId,
    builtAt: new Date().toISOString(),
  }

  // Get project files from Tauri backend
  let files: string[] = []
  try {
    files = await invoke<string[]>('list_project_files', { path: projectPath })
  } catch {
    return graph
  }

  // Filter to TypeScript/React files
  const tsFiles = files.filter((f) =>
    /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('node_modules') && !f.includes('.d.ts')
  )

  // Read and analyze each file
  for (const filePath of tsFiles.slice(0, 200)) { // Cap at 200 files for performance
    try {
      const content = await invoke<string>('read_file_content', { path: `${projectPath}/${filePath}` })
      if (!content) continue

      // Create file node
      const fileId = `file:${filePath}`
      graph.nodes.set(fileId, {
        id: fileId,
        kind: 'file',
        name: filePath.split('/').pop() || filePath,
        filePath,
      })

      analyzeFile(graph, fileId, filePath, content)
    } catch {
      // File read failed — skip
    }
  }

  currentGraph = graph
  return graph
}

/**
 * Analyze a single file and extract nodes + edges.
 */
function analyzeFile(graph: CodeGraph, fileId: string, filePath: string, content: string): void {
  // 1. Extract imports → creates import edges
  const importRegex = /import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1]
    if (importPath.startsWith('.')) {
      // Resolve relative import to file path
      const resolved = resolveImport(filePath, importPath)
      const targetId = `file:${resolved}`
      graph.edges.push({ source: fileId, target: targetId, kind: 'imports' })
    }
  }

  // 2. Extract function/const declarations → creates function nodes
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g
  while ((match = funcRegex.exec(content)) !== null) {
    const funcId = `func:${filePath}:${match[1]}`
    graph.nodes.set(funcId, {
      id: funcId,
      kind: 'function',
      name: match[1],
      filePath,
      line: getLineNumber(content, match.index),
    })
    graph.edges.push({ source: fileId, target: funcId, kind: 'exports' })
  }

  // 3. Extract React components → creates component nodes
  const componentRegex = /(?:export\s+)?(?:function|const)\s+([A-Z]\w+)(?:\s*[=(])/g
  while ((match = componentRegex.exec(content)) !== null) {
    const compId = `comp:${filePath}:${match[1]}`
    if (!graph.nodes.has(compId)) {
      graph.nodes.set(compId, {
        id: compId,
        kind: 'component',
        name: match[1],
        filePath,
        line: getLineNumber(content, match.index),
      })
      graph.edges.push({ source: fileId, target: compId, kind: 'exports' })
    }
  }

  // 4. Extract Zustand store usage → creates uses_store edges
  const storeRegex = /use(\w+Store)\s*\(/g
  while ((match = storeRegex.exec(content)) !== null) {
    const storeName = match[1]
    const storeId = `store:${storeName}`

    if (!graph.nodes.has(storeId)) {
      graph.nodes.set(storeId, {
        id: storeId,
        kind: 'store',
        name: storeName,
        filePath: `stores/${storeName}.ts`,
      })
    }

    // Find which component in this file uses the store
    const componentNodes = [...graph.nodes.values()].filter(
      (n) => n.kind === 'component' && n.filePath === filePath
    )
    for (const comp of componentNodes) {
      graph.edges.push({ source: comp.id, target: storeId, kind: 'uses_store' })
    }

    // Also add file-level dependency
    graph.edges.push({ source: fileId, target: storeId, kind: 'uses_store' })
  }

  // 5. Extract hook usage → creates uses_hook edges
  const hookRegex = /\b(use[A-Z]\w+)\s*\(/g
  while ((match = hookRegex.exec(content)) !== null) {
    const hookName = match[1]
    if (hookName.endsWith('Store')) continue // Already handled above
    const hookId = `hook:${hookName}`
    if (!graph.nodes.has(hookId)) {
      graph.nodes.set(hookId, { id: hookId, kind: 'hook', name: hookName, filePath: 'react' })
    }
    graph.edges.push({ source: fileId, target: hookId, kind: 'uses_hook' })
  }

  // 6. Extract component renders (JSX) → creates renders edges
  const jsxRegex = /<([A-Z]\w+)[\s/>]/g
  while ((match = jsxRegex.exec(content)) !== null) {
    const childName = match[1]
    // Find parent component in this file
    const parentComponents = [...graph.nodes.values()].filter(
      (n) => n.kind === 'component' && n.filePath === filePath
    )
    if (parentComponents.length > 0) {
      const childId = findNodeByName(graph, childName, 'component')
      if (childId) {
        graph.edges.push({ source: parentComponents[0].id, target: childId, kind: 'renders' })
      }
    }
  }

  // 7. Extract type/interface definitions → creates type nodes
  const typeRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g
  while ((match = typeRegex.exec(content)) !== null) {
    const typeId = `type:${filePath}:${match[1]}`
    graph.nodes.set(typeId, {
      id: typeId,
      kind: 'type',
      name: match[1],
      filePath,
      line: getLineNumber(content, match.index),
    })
  }
}

// ── Query API ──

/**
 * Find all nodes that depend on a given node (reverse dependency).
 * "What would break if I change this?"
 */
export function findDependents(nodeId: string): GraphNode[] {
  if (!currentGraph) return []
  const dependentIds = new Set<string>()

  // BFS through reverse edges
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of currentGraph.edges) {
      if (edge.target === current && !dependentIds.has(edge.source)) {
        dependentIds.add(edge.source)
        queue.push(edge.source)
      }
    }
  }

  return [...dependentIds]
    .map((id) => currentGraph!.nodes.get(id))
    .filter((n): n is GraphNode => n !== undefined)
}

/**
 * Find all nodes that a given node depends on (forward dependency).
 * "What does this file/function need?"
 */
export function findDependencies(nodeId: string): GraphNode[] {
  if (!currentGraph) return []
  const depIds = new Set<string>()

  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of currentGraph.edges) {
      if (edge.source === current && !depIds.has(edge.target)) {
        depIds.add(edge.target)
        queue.push(edge.target)
      }
    }
  }

  return [...depIds]
    .map((id) => currentGraph!.nodes.get(id))
    .filter((n): n is GraphNode => n !== undefined)
}

/**
 * Find which components use a specific store.
 */
export function findStoreUsers(storeName: string): GraphNode[] {
  if (!currentGraph) return []
  const storeId = `store:${storeName}`
  return currentGraph.edges
    .filter((e) => e.target === storeId && e.kind === 'uses_store')
    .map((e) => currentGraph!.nodes.get(e.source))
    .filter((n): n is GraphNode => n !== undefined && n.kind === 'component')
}

/**
 * Find dead code — nodes with no incoming edges (except file nodes).
 */
export function findDeadCode(): GraphNode[] {
  if (!currentGraph) return []
  const nodesWithIncoming = new Set(currentGraph.edges.map((e) => e.target))
  return [...currentGraph.nodes.values()].filter(
    (n) => n.kind !== 'file' && n.kind !== 'hook' && !nodesWithIncoming.has(n.id)
  )
}

/**
 * Get graph statistics for dashboard display.
 */
export function getGraphStats(): {
  totalNodes: number
  totalEdges: number
  nodesByKind: Record<string, number>
  topConnected: Array<{ name: string; connections: number }>
} {
  if (!currentGraph) return { totalNodes: 0, totalEdges: 0, nodesByKind: {}, topConnected: [] }

  const nodesByKind: Record<string, number> = {}
  for (const node of currentGraph.nodes.values()) {
    nodesByKind[node.kind] = (nodesByKind[node.kind] || 0) + 1
  }

  // Find most connected nodes
  const connectionCount = new Map<string, number>()
  for (const edge of currentGraph.edges) {
    connectionCount.set(edge.source, (connectionCount.get(edge.source) || 0) + 1)
    connectionCount.set(edge.target, (connectionCount.get(edge.target) || 0) + 1)
  }

  const topConnected = [...connectionCount.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id, count]) => ({
      name: currentGraph!.nodes.get(id)?.name || id,
      connections: count,
    }))

  return {
    totalNodes: currentGraph.nodes.size,
    totalEdges: currentGraph.edges.length,
    nodesByKind,
    topConnected,
  }
}

/**
 * Format graph context for agent prompt injection.
 * Provides relevant subgraph for a set of files being modified.
 */
export function formatGraphContextForAgent(filePaths: string[]): string {
  if (!currentGraph || filePaths.length === 0) return ''

  const sections: string[] = []

  for (const fp of filePaths.slice(0, 5)) {
    const fileId = `file:${fp}`
    const deps = findDependencies(fileId).slice(0, 10)
    const dependents = findDependents(fileId).slice(0, 10)

    if (deps.length > 0 || dependents.length > 0) {
      let section = `📊 ${fp}:`
      if (deps.length > 0) {
        section += `\n  Nutzt: ${deps.map((n) => n.name).join(', ')}`
      }
      if (dependents.length > 0) {
        section += `\n  Genutzt von: ${dependents.map((n) => `${n.name} (${n.filePath})`).join(', ')}`
      }
      sections.push(section)
    }
  }

  if (sections.length === 0) return ''
  return `\n--- Code-Graph (Abhängigkeiten) ---\n${sections.join('\n')}\n`
}

/**
 * Get the current graph (or null if not built yet).
 */
export function getCurrentGraph(): CodeGraph | null {
  return currentGraph
}

// ── Helpers ──

function resolveImport(fromFile: string, importPath: string): string {
  const fromDir = fromFile.split('/').slice(0, -1).join('/')
  const parts = importPath.split('/')
  let resolved = fromDir

  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') {
      resolved = resolved.split('/').slice(0, -1).join('/')
    } else {
      resolved = resolved ? `${resolved}/${part}` : part
    }
  }

  // Try common extensions
  if (!resolved.match(/\.\w+$/)) {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
      resolved += ext
      break // Just use .ts as default
    }
  }

  return resolved
}

function getLineNumber(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split('\n').length
}

function findNodeByName(graph: CodeGraph, name: string, kind: NodeKind): string | null {
  for (const [id, node] of graph.nodes) {
    if (node.name === name && node.kind === kind) return id
  }
  return null
}
