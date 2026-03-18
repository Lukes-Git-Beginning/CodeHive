import { invoke } from '@tauri-apps/api/core'
import { appDataDir } from '@tauri-apps/api/path'
import type { Project } from '../types/project'
import { getSetting, setSetting } from './persistence'

export interface McpServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
}

// Default MCP servers that can be enabled per project
export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-filesystem'],
    enabled: false,
  },
  {
    id: 'git',
    name: 'Git',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-git'],
    enabled: false,
  },
  {
    id: 'memory',
    name: 'Memory',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-memory'],
    enabled: false,
  },
  {
    id: 'fetch',
    name: 'Web Fetch',
    command: 'npx',
    args: ['-y', '@anthropic-ai/mcp-fetch'],
    enabled: false,
  },
]

const ALLOWED_COMMANDS = new Set(['npx', 'node', 'uvx', 'docker', 'python', 'python3'])

function isValidMcpServer(obj: unknown): obj is McpServerConfig {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' &&
    typeof o.command === 'string' && Array.isArray(o.args) && typeof o.enabled === 'boolean'
}

function sanitizePath(p: string): string {
  // Normalize and reject path traversal
  return p.replace(/\.\.[/\\]/g, '').replace(/\.\.$/, '')
}

/**
 * Load MCP server configurations from settings.
 */
export async function loadMcpServers(): Promise<McpServerConfig[]> {
  const saved = await getSetting('mcp_servers')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return [...DEFAULT_MCP_SERVERS]
      const validated = parsed.filter(isValidMcpServer)
      return validated.length > 0 ? validated : [...DEFAULT_MCP_SERVERS]
    } catch {
      return [...DEFAULT_MCP_SERVERS]
    }
  }
  return [...DEFAULT_MCP_SERVERS]
}

/**
 * Save MCP server configurations to settings.
 */
export async function saveMcpServers(servers: McpServerConfig[]): Promise<void> {
  await setSetting('mcp_servers', JSON.stringify(servers))
}

/**
 * Generate an MCP config JSON file for a project and return the file path.
 * Only includes enabled servers.
 */
export async function generateMcpConfig(project: Project): Promise<string | null> {
  const servers = await loadMcpServers()
  const enabledServers = servers.filter((s) => s.enabled)

  if (enabledServers.length === 0) return null

  const mcpConfig: Record<string, { command: string; args: string[] }> = {}

  for (const server of enabledServers) {
    // Command injection guard: only allow whitelisted commands
    if (!ALLOWED_COMMANDS.has(server.command)) {
      console.warn(`MCP server '${server.id}' uses disallowed command '${server.command}', skipping`)
      continue
    }

    const args = [...server.args]

    // For filesystem server, add the project path as an allowed directory
    if (server.id === 'filesystem') {
      args.push(sanitizePath(project.path))
    }

    mcpConfig[server.id] = {
      command: server.command,
      args,
    }
  }

  if (Object.keys(mcpConfig).length === 0) return null

  const configJson = JSON.stringify({ mcpServers: mcpConfig }, null, 2)

  // Validate project.id for safe file path usage
  const safeId = project.id.replace(/[^a-zA-Z0-9_-]/g, '_')

  // Write config to app data directory
  const dataDir = await appDataDir()
  const configPath = `${dataDir}mcp-config-${safeId}.json`

  // Use Tauri to write the file
  try {
    await invoke('write_temp_file', {
      path: configPath,
      content: configJson,
    })
  } catch (err) {
    console.warn('Could not write MCP config file:', err)
    return null
  }

  return configPath
}
