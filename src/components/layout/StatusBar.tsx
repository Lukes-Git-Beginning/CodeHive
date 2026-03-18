import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal } from 'lucide-react'
import { checkClaudeCli } from '../../services/orchestrator'
import { useAgentStore } from '../../stores/agentStore'
import { useProjectStore } from '../../stores/projectStore'
import { StatusDot } from '../ui/StatusDot'

export function StatusBar() {
  const [claudeVersion, setClaudeVersion] = useState<string | null>(null)
  const phase = useAgentStore((s) => s.phase)
  const activeProject = useProjectStore((s) => s.getActiveProject())

  useEffect(() => {
    checkClaudeCli().then(setClaudeVersion).catch(() => setClaudeVersion(null))
  }, [])

  const isRunning = phase !== 'idle' && phase !== 'done'

  return (
    <div role="status" className="h-7 glass border-t border-border flex items-center px-4 text-[11px] text-text-muted shrink-0 relative z-10">
      {/* Active run indicator */}
      {isRunning && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-px bg-accent"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Left: CLI Status */}
      <div className="flex items-center gap-2">
        <StatusDot status={claudeVersion ? 'online' : 'error'} size={6} pulse={false} />
        <span>
          {claudeVersion ? `Claude ${claudeVersion.split('\n')[0].trim()}` : 'CLI nicht gefunden'}
        </span>
      </div>

      <div className="flex-1" />

      {/* Center: Active project + phase */}
      {activeProject && (
        <div className="flex items-center gap-3 text-text-secondary">
          <span className="font-mono">{activeProject.name}</span>
          {isRunning && (
            <span className="text-accent font-mono">
              [{phase.toUpperCase()}]
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Right: Version */}
      <div className="flex items-center gap-1.5">
        <Terminal className="w-3 h-3" />
        <span className="font-mono">v0.1.0</span>
      </div>
    </div>
  )
}
