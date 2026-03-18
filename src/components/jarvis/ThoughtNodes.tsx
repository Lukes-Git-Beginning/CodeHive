import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'
import { Cpu, Search, Shield, Wrench, Eye, Code } from 'lucide-react'
import type { AgentInstance } from '../../types/agent'

const ROLE_CONFIG: Record<string, { icon: typeof Cpu; label: string }> = {
  orchestrator: { icon: Search, label: 'ORCHESTRATOR' },
  frontend: { icon: Eye, label: 'FRONTEND' },
  backend: { icon: Wrench, label: 'BACKEND' },
  testing: { icon: Shield, label: 'TESTING' },
  architect: { icon: Code, label: 'ARCHITECT' },
  devops: { icon: Wrench, label: 'DEVOPS' },
  security: { icon: Shield, label: 'SECURITY' },
  uiux: { icon: Eye, label: 'UI/UX' },
}

const STATUS_COLORS: Record<string, string> = {
  working: '#00d4ff',
  thinking: '#00d4ff',
  done: 'rgba(255,255,255,0.25)',
  error: '#ff3366',
  idle: 'rgba(255,255,255,0.15)',
}

const STATUS_LABELS: Record<string, string> = {
  working: 'Active',
  thinking: 'Active',
  done: 'Done',
  error: 'Error',
  idle: 'Idle',
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
  const config = ROLE_CONFIG[agent.role] || { icon: Cpu, label: agent.role.toUpperCase() }
  const Icon = config.icon
  const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
  const statusLabel = STATUS_LABELS[agent.status] || 'Idle'
  const isActive = agent.status === 'working' || agent.status === 'thinking'

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
        left: `calc(50% + ${x}px - 44px)`,
        top: `calc(50% + ${y}px - 28px)`,
      }}
      onClick={onOpenMindPalace}
      title={`${agent.role}: ${agent.currentTask?.slice(0, 80) || 'Idle'}`}
    >
      {/* Glow ring for active agents */}
      {isActive && (
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-[-4px] rounded-lg"
          style={{
            backgroundColor: `${color}15`,
            filter: 'blur(8px)',
          }}
        />
      )}

      {/* Badge container — wider, with data */}
      <motion.div
        animate={isActive ? {
          boxShadow: [`0 0 6px ${color}30`, `0 0 14px ${color}50`, `0 0 6px ${color}30`],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="relative glass-elevated rounded-lg px-3 py-2 flex items-center gap-2.5"
        style={{
          borderColor: `${color}40`,
          borderWidth: '1px',
          minWidth: 88,
        }}
      >
        {/* Icon */}
        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-[7px] font-hud leading-tight text-text-primary truncate">
            {config.label}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: color }}
            />
            <span className="text-[7px] font-mono" style={{ color, opacity: 0.8 }}>
              {statusLabel}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function ThoughtNodes({ onOpenMindPalace }: ThoughtNodesProps) {
  const currentRun = useAgentStore((s) => s.currentRun)
  const phase = useAgentStore((s) => s.phase)
  const agents = currentRun?.agents || []
  const isIdle = phase === 'idle' || phase === 'done'

  if (isIdle || agents.length === 0) return null

  const radius = 190
  const startAngle = -90
  const angleStep = agents.length > 1 ? 360 / agents.length : 0

  return (
    <div className="absolute pointer-events-none z-10" style={{ inset: '-100px' }}>
      {/* Orbit path */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        className="absolute rounded-full border border-dashed"
        style={{
          left: `calc(50% - ${radius}px)`,
          top: `calc(50% - ${radius}px)`,
          width: radius * 2,
          height: radius * 2,
          borderColor: 'rgba(0, 212, 255, 0.04)',
        }}
      />

      {/* Connection lines */}
      {agents.map((agent, i) => {
        const lineAngle = startAngle + i * angleStep
        const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle
        const lineLength = radius - 30
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
              transform: `rotate(${lineAngle}deg)`,
              background: `linear-gradient(90deg, transparent, ${color}20)`,
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
