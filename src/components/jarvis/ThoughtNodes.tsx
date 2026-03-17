import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'
import { useChatStore } from '../../stores/chatStore'
import { FileCode, Cpu, Search, Shield, Wrench, Eye } from 'lucide-react'
import type { AgentInstance } from '../../types/agent'

const ROLE_ICONS: Record<string, typeof Cpu> = {
  orchestrator: Search,
  frontend: Eye,
  backend: Wrench,
  testing: Shield,
  architect: Search,
  devops: Wrench,
  security: Shield,
  uiux: Eye,
}

const STATUS_COLORS: Record<string, string> = {
  working: '#00ff88',
  thinking: '#00d4ff',
  done: 'rgba(255,255,255,0.2)',
  error: '#ff3366',
  idle: 'rgba(255,255,255,0.1)',
}

function ThoughtNode({
  agent,
  side,
  index,
}: {
  agent: AgentInstance
  side: 'left' | 'right'
  index: number
}) {
  const Icon = ROLE_ICONS[agent.role] || Cpu
  const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
  const isActive = agent.status === 'working' || agent.status === 'thinking'
  const lastOutput = agent.output.length > 0 ? agent.output[agent.output.length - 1] : ''

  // Vertical offset from center
  const yOffset = (index - 0.5) * 80

  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -30 : 30, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: side === 'left' ? -20 : 20, scale: 0.8 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`absolute ${side === 'left' ? 'left-6' : 'right-6'}`}
      style={{ top: `calc(50% + ${yOffset}px)`, transform: 'translateY(-50%)' }}
    >
      <div className="flex items-center gap-3">
        {/* Connection line (left side: line on right, right side: line on left) */}
        {side === 'right' && (
          <div className="w-8 h-px shrink-0" style={{ backgroundColor: `${color}30` }} />
        )}

        {/* Node card */}
        <motion.div
          animate={isActive ? {
            boxShadow: [`0 0 4px ${color}20`, `0 0 10px ${color}40`, `0 0 4px ${color}20`],
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className="glass rounded-lg px-3 py-2 max-w-52 border"
          style={{ borderColor: `${color}25` }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="w-3 h-3 shrink-0" style={{ color }} />
            <span className="font-hud text-[8px] uppercase" style={{ color }}>
              {agent.role}
            </span>
            {isActive && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
                style={{ backgroundColor: color }}
              />
            )}
          </div>

          {agent.currentTask && (
            <p className="text-[9px] text-text-secondary truncate">
              {agent.currentTask.slice(0, 55)}
            </p>
          )}

          {lastOutput && isActive && (
            <p className="text-[8px] text-text-muted font-mono truncate mt-0.5">
              {lastOutput.slice(0, 45)}
            </p>
          )}
        </motion.div>

        {/* Connection line */}
        {side === 'left' && (
          <div className="w-8 h-px shrink-0" style={{ backgroundColor: `${color}30` }} />
        )}
      </div>
    </motion.div>
  )
}

function IdleThoughts() {
  const messages = useChatStore((s) => s.messages)
  const lastMessages = messages.slice(-2)

  if (lastMessages.length === 0) return null

  return (
    <>
      {lastMessages.map((msg, i) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 0.4, x: 0 }}
          transition={{ delay: i * 0.2 }}
          className="absolute left-6"
          style={{ top: `calc(45% + ${(i - 0.5) * 50}px)` }}
        >
          <div className="glass rounded-md px-2.5 py-1.5 max-w-44 border border-border/30">
            <div className="flex items-center gap-1 mb-0.5">
              <FileCode className="w-2.5 h-2.5 text-text-muted" />
              <span className="font-hud text-[7px] text-text-muted">{msg.role}</span>
            </div>
            <p className="text-[8px] text-text-muted truncate">{msg.content.slice(0, 40)}</p>
          </div>
        </motion.div>
      ))}
    </>
  )
}

export function ThoughtNodes() {
  const currentRun = useAgentStore((s) => s.currentRun)
  const phase = useAgentStore((s) => s.phase)
  const agents = currentRun?.agents || []
  const isIdle = phase === 'idle' || phase === 'done'

  // Split agents: even indices left, odd indices right
  const leftAgents = agents.filter((_, i) => i % 2 === 0)
  const rightAgents = agents.filter((_, i) => i % 2 === 1)

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <AnimatePresence>
        {leftAgents.map((agent, i) => (
          <ThoughtNode key={agent.id} agent={agent} side="left" index={i} />
        ))}
        {rightAgents.map((agent, i) => (
          <ThoughtNode key={agent.id} agent={agent} side="right" index={i} />
        ))}

        {isIdle && agents.length === 0 && <IdleThoughts key="idle" />}
      </AnimatePresence>
    </div>
  )
}
