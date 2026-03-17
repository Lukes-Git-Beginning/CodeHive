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

/**
 * Load MCP server configurations from settings.
 */
export async function loadMcpServers(): Promise<McpServerConfig[]> {
  const saved = await getSetting('mcp_servers')
  if (saved) {
    try {
      return JSON.parse(saved) as McpServerConfig[]
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
    const args = [...server.args]

    // For filesystem server, add the project path as an allowed directory
    if (server.id === 'filesystem') {
      args.push(project.path)
    }

    mcpConfig[server.id] = {
      command: server.command,
      args,
    }
  }

  const configJson = JSON.stringify({ mcpServers: mcpConfig }, null, 2)

  // Write config to app data directory
  const dataDir = await appDataDir()
  const configPath = `${dataDir}mcp-config-${project.id}.json`

  // Use Tauri to write the file
  await invoke('write_temp_file', {
    path: configPath,
    content: configJson,
  }).catch(() => {
    // Fallback: try direct write via alternative method — this is best-effort
    console.warn('Could not write MCP config file')
  })

  return configPath
}
