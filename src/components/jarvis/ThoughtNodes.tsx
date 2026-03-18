import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'
import { Cpu, Search, Shield, Wrench, Eye, Code } from 'lucide-react'
import type { AgentInstance } from '../../types/agent'

const ROLE_CONFIG: Record<string, { icon: typeof Cpu; label: string }> = {
  orchestrator: { icon: Search, label: 'ORC' },
  frontend: { icon: Eye, label: 'FRN' },
  backend: { icon: Wrench, label: 'BAK' },
  testing: { icon: Shield, label: 'TST' },
  architect: { icon: Code, label: 'ARC' },
  devops: { icon: Wrench, label: 'DEV' },
  security: { icon: Shield, label: 'SEC' },
  uiux: { icon: Eye, label: 'UIX' },
}

const STATUS_COLORS: Record<string, string> = {
  working: '#00d4ff',
  thinking: '#00d4ff',
  done: 'rgba(255,255,255,0.25)',
  error: '#ff3366',
  idle: 'rgba(255,255,255,0.15)',
}

interface ThoughtNodesProps {
  onOpenMindPalace?: () => void
}

function Badge({
  agent,
  angle,
  radius,
  onOpenMindPalace,
}: {
  agent: AgentInstance
  angle: number
  radius: number
  onOpenMindPalace?: () => void
}) {
  const config = ROLE_CONFIG[agent.role] || { icon: Cpu, label: 'AGT' }
  const Icon = config.icon
  const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
  const isActive = agent.status === 'working' || agent.status === 'thinking'

  // Calculate position on orbit circle
  const x = Math.cos((angle * Math.PI) / 180) * radius
  const y = Math.sin((angle * Math.PI) / 180) * radius

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="absolute pointer-events-auto cursor-pointer"
      style={{
        left: `calc(50% + ${x}px - 24px)`,
        top: `calc(50% + ${y}px - 24px)`,
      }}
      onClick={onOpenMindPalace}
      title={`${agent.role}: ${agent.currentTask?.slice(0, 80) || 'Idle'}`}
    >
      {/* Glow ring for active agents */}
      {isActive && (
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0"
          style={{
            backgroundColor: `${color}20`,
            filter: 'blur(8px)',
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        />
      )}

      {/* Badge circle — hexagonal */}
      <motion.div
        animate={isActive ? {
          boxShadow: [`0 0 6px ${color}40`, `0 0 14px ${color}60`, `0 0 6px ${color}40`],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="relative w-12 h-12 glass-elevated flex flex-col items-center justify-center gap-0.5"
        style={{
          borderColor: `${color}50`,
          borderWidth: '1.5px',
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-[7px] font-hud leading-none" style={{ color }}>
          {config.label}
        </span>
      </motion.div>

      {/* Pulse dot */}
      {isActive && (
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </motion.div>
  )
}

export function ThoughtNodes({ onOpenMindPalace }: ThoughtNodesProps) {
  const currentRun = useAgentStore((s) => s.currentRun)
  const phase = useAgentStore((s) => s.phase)
  const agents = currentRun?.agents || []
  const isIdle = phase === 'idle' || phase === 'done'

  if (isIdle || agents.length === 0) return null

  // Distribute agents evenly around the orbit
  const radius = 150
  const startAngle = -90 // Start from top
  const angleStep = agents.length > 1 ? 360 / agents.length : 0

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Orbit path (subtle, slowly rotating) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute rounded-full border border-dashed"
        style={{
          left: `calc(50% - ${radius}px)`,
          top: `calc(50% - ${radius}px)`,
          width: radius * 2,
          height: radius * 2,
          borderColor: 'rgba(0, 212, 255, 0.06)',
        }}
      />

      {/* Connection lines from center to each badge */}
      {agents.map((agent, i) => {
        const angle = startAngle + i * angleStep
        const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
        const lineLength = radius - 24 // minus badge radius
        return (
          <div
            key={`line-${agent.id}`}
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: `${lineLength}px`,
              height: '1px',
              transformOrigin: '0 0',
              transform: `rotate(${angle}deg)`,
              background: `linear-gradient(90deg, transparent, ${color}30)`,
            }}
          />
        )
      })}

      <AnimatePresence>
        {agents.map((agent, i) => (
          <Badge
            key={agent.id}
            agent={agent}
            angle={startAngle + i * angleStep}
            radius={radius}
            onOpenMindPalace={onOpenMindPalace}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
