import { motion } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'

const PHASE_COLORS: Record<string, { core: string; glow: string; ring: string }> = {
  idle: { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.2)', ring: 'rgba(0, 255, 136, 0.15)' },
  planning: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', ring: 'rgba(0, 212, 255, 0.25)' },
  awaiting_approval: { core: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)', ring: 'rgba(255, 170, 0, 0.25)' },
  executing: { core: '#7b61ff', glow: 'rgba(123, 97, 255, 0.4)', ring: 'rgba(123, 97, 255, 0.3)' },
  verifying: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)', ring: 'rgba(0, 212, 255, 0.25)' },
  done: { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.6)', ring: 'rgba(0, 255, 136, 0.3)' },
  error: { core: '#ff3366', glow: 'rgba(255, 51, 102, 0.5)', ring: 'rgba(255, 51, 102, 0.3)' },
}

export function JarvisCore() {
  const phase = useAgentStore((s) => s.phase)
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.idle
  const isActive = phase !== 'idle' && phase !== 'done'

  return (
    <div className="relative flex items-center justify-center w-56 h-56 mb-6 shrink-0">
      {/* Outer ambient glow */}
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

      {/* Outer ring — visible, colored by phase */}
      <motion.div
        animate={{
          rotate: isActive ? [0, 360] : 0,
          scale: [1, 1.02, 1],
        }}
        transition={{
          rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
          scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute w-48 h-48 rounded-full"
        style={{
          border: `1px solid ${colors.ring}`,
          boxShadow: isActive ? `0 0 8px ${colors.ring}` : 'none',
        }}
      />

      {/* Middle ring — dashed, counter-rotate */}
      <motion.div
        animate={{
          rotate: isActive ? [0, -360] : 0,
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="absolute w-40 h-40 rounded-full"
        style={{
          border: `1px dashed ${colors.ring}`,
        }}
      />

      {/* Inner ring — pulsing */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.08, 1] : [1, 1.03, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-28 h-28 rounded-full"
        style={{
          border: `1px solid ${colors.ring}`,
        }}
      />

      {/* Core sphere */}
      <motion.div
        key={`core-${phase}`}
        initial={{ scale: 0.9 }}
        animate={{
          scale: isActive ? [1, 1.1, 1] : [1, 1.04, 1],
        }}
        transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-full flex items-center justify-center relative z-10"
        style={{
          background: `radial-gradient(circle at 40% 40%, ${colors.core}40, ${colors.core}15)`,
          border: `1.5px solid ${colors.core}60`,
          boxShadow: `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}, inset 0 0 20px ${colors.glow}`,
        }}
      >
        {/* Inner bright core */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-full"
          style={{
            backgroundColor: colors.core,
            filter: 'blur(6px)',
            boxShadow: `0 0 15px ${colors.core}`,
          }}
        />
      </motion.div>
    </div>
  )
}
