import { invoke } from '@tauri-apps/api/core'

export interface ModuleInfo {
  path: string
  type: 'component' | 'service' | 'store' | 'type' | 'rust' | 'config' | 'style' | 'other'
  name: string
  sizeBytes: number
}

export interface ScanResult {
  modules: ModuleInfo[]
  totalFiles: number
  modulesByType: Record<string, ModuleInfo[]>
  summary: string
}

function categorizeFile(path: string): ModuleInfo['type'] {
  const p = path.replace(/\\/g, '/').toLowerCase()
  if (p.includes('/components/')) return 'component'
  if (p.includes('/services/')) return 'service'
  if (p.includes('/stores/')) return 'store'
  if (p.includes('/types/')) return 'type'
  if (p.endsWith('.rs')) return 'rust'
  if (p.endsWith('.css') || p.endsWith('.scss')) return 'style'
  if (p.endsWith('.json') || p.endsWith('.toml') || p.endsWith('.yaml')) return 'config'
  return 'other'
}

function getFileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() || path
}

interface FileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  children: FileEntry[]
}

function flattenEntries(entries: FileEntry[], prefix = ''): string[] {
  const paths: string[] = []
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.is_dir) {
      paths.push(...flattenEntries(entry.children, fullPath))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

export async function scanCodebase(projectPath: string): Promise<ScanResult> {
  try {
    const entries = await invoke<FileEntry[]>('list_project_files', { path: projectPath })
    const files = flattenEntries(entries)

    const modules: ModuleInfo[] = files
      .filter(f => /\.(tsx?|rs|css|json|toml)$/.test(f))
      .map(f => ({
        path: f,
        type: categorizeFile(f),
        name: getFileName(f),
        sizeBytes: 0,
      }))

    const modulesByType: Record<string, ModuleInfo[]> = {}
    for (const mod of modules) {
      if (!modulesByType[mod.type]) modulesByType[mod.type] = []
      modulesByType[mod.type].push(mod)
    }

    const typeCounts = Object.entries(modulesByType)
      .map(([type, mods]) => `${type}: ${mods.length}`)
      .join(', ')

    const summary = `Codebase: ${modules.length} Dateien (${typeCounts})\n` +
      Object.entries(modulesByType)
        .map(([type, mods]) => `\n## ${type.toUpperCase()} (${mods.length}):\n${mods.map(m => `- ${m.path}`).join('\n')}`)
        .join('\n')

    return {
      modules,
      totalFiles: modules.length,
      modulesByType,
      summary,
    }
  } catch (err) {
    console.error('Codebase scan failed:', err)
    return { modules: [], totalFiles: 0, modulesByType: {}, summary: 'Scan fehlgeschlagen' }
  }
}
