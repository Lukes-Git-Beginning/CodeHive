import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Server, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { loadMcpServers, saveMcpServers, type McpServerConfig } from '../../services/mcpConfig'
import { useNotificationStore } from '../../stores/notificationStore'

export function MCPSettings() {
  const [servers, setServers] = useState<McpServerConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('npx')
  const [newArgs, setNewArgs] = useState('')
  const addNotification = useNotificationStore((s) => s.addNotification)

  useEffect(() => {
    loadMcpServers().then(setServers)
  }, [])

  const handleToggle = async (id: string) => {
    const updated = servers.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    )
    setServers(updated)
    await saveMcpServers(updated)
  }

  const handleDelete = async (id: string) => {
    const updated = servers.filter((s) => s.id !== id)
    setServers(updated)
    await saveMcpServers(updated)
    addNotification('info', 'MCP Server entfernt')
  }

  const handleAdd = async () => {
    if (!newName.trim() || !newCommand.trim()) return
    const server: McpServerConfig = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      command: newCommand.trim(),
      args: newArgs.split(' ').filter(Boolean),
      enabled: true,
    }
    const updated = [...servers, server]
    setServers(updated)
    await saveMcpServers(updated)
    setNewName('')
    setNewCommand('npx')
    setNewArgs('')
    setShowAddForm(false)
    addNotification('success', `MCP Server "${server.name}" hinzugefügt`)
  }

  const enabledCount = servers.filter((s) => s.enabled).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan" />
          <span className="font-hud text-xs text-cyan">MCP Servers</span>
          <span className="text-[9px] text-text-muted font-mono">
            {enabledCount}/{servers.length} aktiv
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="glass neon-hover rounded-lg px-2 py-1 text-[10px] text-text-muted hover:text-accent flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Custom
        </button>
      </div>

      {/* Server List */}
      <div className="space-y-1.5 mb-3">
        {servers.map((server) => (
          <div
            key={server.id}
            className="flex items-center gap-2 glass rounded-lg px-3 py-2"
          >
            <button onClick={() => handleToggle(server.id)}>
              {server.enabled ? (
                <ToggleRight className="w-4 h-4 text-accent" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-text-muted" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <span className={`text-xs ${server.enabled ? 'text-text-primary' : 'text-text-muted'}`}>
                {server.name}
              </span>
              <p className="text-[9px] text-text-muted font-mono truncate">
                {server.command} {server.args.join(' ')}
              </p>
            </div>
            {server.id.startsWith('custom-') && (
              <button
                onClick={() => handleDelete(server.id)}
                className="text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Custom Server Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass rounded-lg p-3 space-y-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Server Name"
            className="w-full glass rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted
                       focus:outline-none focus:border-accent/40 font-mono"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              placeholder="Command (z.B. npx)"
              className="w-24 glass rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted
                         focus:outline-none focus:border-accent/40 font-mono"
            />
            <input
              type="text"
              value={newArgs}
              onChange={(e) => setNewArgs(e.target.value)}
              placeholder="Arguments (space-separated)"
              className="flex-1 glass rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted
                         focus:outline-none focus:border-accent/40 font-mono"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="text-[10px] text-text-muted hover:text-text-secondary px-3 py-1"
            >
              Abbrechen
            </button>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newCommand.trim()}
              className="text-[10px] text-accent bg-accent/10 hover:bg-accent/20 px-3 py-1 rounded-lg
                         disabled:opacity-30 transition-all"
            >
              Hinzufügen
            </button>
          </div>
        </motion.div>
      )}

      <p className="text-[9px] text-text-muted mt-2">
        MCP Server erweitern die Fähigkeiten der Agenten. Aktivierte Server werden via --mcp-config an Claude CLI übergeben.
      </p>
    </div>
  )
}
