import { motion } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'
import type { AgentInstance } from '../../types/agent'

const EMPTY_AGENTS: AgentInstance[] = []

const PHASE_COLORS: Record<string, { core: string; glow: string; ring: string }> = {
  idle: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.2)', ring: 'rgba(0, 212, 255, 0.15)' },
  planning: { core: '#1a8fff', glow: 'rgba(26, 143, 255, 0.3)', ring: 'rgba(26, 143, 255, 0.25)' },
  awaiting_approval: { core: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)', ring: 'rgba(255, 170, 0, 0.25)' },
  executing: { core: '#7b61ff', glow: 'rgba(123, 97, 255, 0.4)', ring: 'rgba(123, 97, 255, 0.3)' },
  verifying: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', ring: 'rgba(0, 212, 255, 0.25)' },
  done: { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.6)', ring: 'rgba(0, 255, 136, 0.3)' },
  error: { core: '#ff3366', glow: 'rgba(255, 51, 102, 0.5)', ring: 'rgba(255, 51, 102, 0.3)' },
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

export function JarvisCore() {
  const phase = useAgentStore((s) => s.phase)
  const currentWave = useAgentStore((s) => s.currentWave)
  const totalWaves = useAgentStore((s) => s.totalWaves)
  const agents = useAgentStore((s) => s.currentRun?.agents ?? EMPTY_AGENTS)
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.idle
  const isActive = phase !== 'idle' && phase !== 'done'

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mb-6 shrink-0">
      {/* 1. Particles (behind everything) */}
      {isActive && Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 * Math.PI) / 180
        const delay = i * 0.4
        return (
          <motion.div
            key={`p-${i}`}
            className="absolute rounded-full"
            style={{
              width: 2,
              height: 2,
              backgroundColor: colors.core,
              left: 'calc(50% - 1px)',
              top: 'calc(50% - 1px)',
            }}
            animate={{
              x: [0, Math.cos(angle) * 100],
              y: [0, Math.sin(angle) * 100],
              opacity: [0.8, 0],
              scale: [1, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay,
              ease: 'easeOut',
            }}
          />
        )
      })}

      {/* 2. Outer ambient glow */}
      <motion.div
        key={`glow-${phase}`}
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0.4, 0.7, 0.4],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{ duration: isActive ? 2 : 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full blur-[50px]"
        style={{ backgroundColor: colors.glow }}
      />

      {/* 3. Tick marks SVG */}
      <svg
        className="absolute"
        style={{ width: 208, height: 208 }}
        viewBox="0 0 208 208"
      >
        {Array.from({ length: 60 }, (_, i) => {
          const angle = (i * 6 * Math.PI) / 180
          const r1 = i % 5 === 0 ? 95 : 97
          const r2 = 101
          return (
            <line
              key={i}
              x1={104 + r1 * Math.cos(angle)}
              y1={104 + r1 * Math.sin(angle)}
              x2={104 + r2 * Math.cos(angle)}
              y2={104 + r2 * Math.sin(angle)}
              stroke={colors.ring}
              strokeWidth={i % 5 === 0 ? 1.5 : 0.5}
              opacity={i % 5 === 0 ? 0.8 : 0.4}
            />
          )
        })}
      </svg>

      {/* 4. Outer ring — visible, colored by phase */}
      <motion.div
        animate={{
          rotate: isActive ? [0, 360] : 0,
          scale: [1, 1.02, 1],
        }}
        transition={{
          rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
          scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute w-52 h-52 rounded-full"
        style={{
          border: `1px solid ${colors.ring}`,
          boxShadow: isActive ? `0 0 8px ${colors.ring}` : 'none',
        }}
      />

      {/* 5. Hexagon ring */}
      <motion.div
        animate={{ rotate: isActive ? [0, 360] : [0, 60, 0] }}
        transition={{ duration: isActive ? 25 : 60, repeat: Infinity, ease: 'linear' }}
        className="absolute flex items-center justify-center"
        style={{ width: 152, height: 152 }}
      >
        <svg viewBox="0 0 152 152" className="absolute inset-0" style={{ width: 152, height: 152 }}>
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const r = 68
            const cx = 76 + r * Math.cos((angle * Math.PI) / 180)
            const cy = 76 + r * Math.sin((angle * Math.PI) / 180)
            return (
              <polygon
                key={angle}
                points={hexPoints(cx, cy, 8)}
                fill="none"
                stroke={colors.ring}
                strokeWidth="1"
                opacity={0.6}
              />
            )
          })}
        </svg>
      </motion.div>

      {/* 6. Middle ring — dashed, counter-rotate */}
      <motion.div
        animate={{
          rotate: isActive ? [0, -360] : 0,
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute w-44 h-44 rounded-full"
        style={{
          border: `1px dashed ${colors.ring}`,
        }}
      />

      {/* 7. Inner ring — pulsing */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.08, 1] : [1, 1.03, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-32 h-32 rounded-full"
        style={{
          border: `1px solid ${colors.ring}`,
        }}
      />

      {/* 8. Core sphere */}
      <motion.div
        key={`core-${phase}`}
        initial={{ scale: 0.9 }}
        animate={{
          scale: isActive ? [1, 1.1, 1] : [1, 1.04, 1],
        }}
        transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-full flex items-center justify-center relative z-10"
        style={{
          width: 88,
          height: 88,
          background: `radial-gradient(circle at 40% 40%, white, ${colors.core}80 30%, ${colors.core}40 60%, ${colors.core}15 100%)`,
          border: `1.5px solid ${colors.core}60`,
          boxShadow: `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}, 0 0 60px ${colors.glow}, inset 0 0 20px ${colors.glow}`,
        }}
      >
        {/* Inner bright core */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-12 h-12 rounded-full"
          style={{
            backgroundColor: colors.core,
            filter: 'blur(6px)',
            boxShadow: `0 0 15px ${colors.core}`,
          }}
        />
      </motion.div>

      {/* 9. Data readouts */}
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ top: -16 }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {phase.toUpperCase().replace('_', ' ')}
        </span>
      </div>
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ bottom: -16 }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {currentWave > 0 ? `WAVE ${currentWave}/${totalWaves}` : 'STANDBY'}
        </span>
      </div>
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ right: -40, top: '50%', transform: 'translateY(-50%)' }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {agents.length > 0 ? `${agents.length} AGT` : '\u2014'}
        </span>
      </div>
    </div>
  )
}
