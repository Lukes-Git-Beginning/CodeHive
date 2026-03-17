import { motion } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'

const PHASE_COLORS: Record<string, { core: string; glow: string }> = {
  idle: { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.2)' },
  planning: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)' },
  awaiting_approval: { core: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)' },
  executing: { core: '#7b61ff', glow: 'rgba(123, 97, 255, 0.4)' },
  verifying: { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)' },
  done: { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.6)' },
  error: { core: '#ff3366', glow: 'rgba(255, 51, 102, 0.5)' },
}

const ANIMATION_VARIANTS = {
  idle: {
    scale: [1, 1.05, 1],
    opacity: [0.6, 0.8, 0.6],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const },
  },
  planning: {
    scale: [1, 1.1, 1],
    rotate: [0, 180, 360],
    transition: { duration: 3, repeat: Infinity, ease: 'linear' as const },
  },
  awaiting_approval: {
    scale: [1, 1.08, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
  },
  executing: {
    scale: [0.95, 1.15, 0.95],
    rotate: [0, -180, -360],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
  },
  verifying: {
    scale: [1, 1.12, 1],
    opacity: [0.8, 1, 0.8],
    transition: { duration: 1.2, repeat: Infinity, ease: 'backInOut' as const },
  },
  done: {
    scale: [1, 1.3, 1],
    opacity: [1, 0.5, 1],
    transition: { duration: 1, ease: 'circOut' as const },
  },
  error: {
    x: [-4, 4, -4, 4, 0],
    transition: { duration: 0.5 },
  },
}

export function JarvisCore() {
  const phase = useAgentStore((s) => s.phase)
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.idle
  const animation = ANIMATION_VARIANTS[phase] || ANIMATION_VARIANTS.idle

  return (
    <div className="relative flex items-center justify-center w-64 h-64 mb-8">
      {/* Outer ambient glow */}
      <motion.div
        animate={animation}
        className="absolute inset-0 rounded-full blur-[40px]"
        style={{ backgroundColor: colors.glow }}
      />

      {/* Outer ring */}
      <motion.div
        animate={animation}
        className="absolute w-44 h-44 rounded-full border border-border flex items-center justify-center"
      >
        <div className="w-full h-full rounded-full border border-dashed border-border opacity-40 absolute" />
      </motion.div>

      {/* Middle ring */}
      <motion.div
        animate={{
          rotate: phase === 'idle' ? 0 : [0, 360],
          transition: { duration: 8, repeat: Infinity, ease: 'linear' as const },
        }}
        className="absolute w-32 h-32 rounded-full border border-border/50"
      />

      {/* Core sphere */}
      <motion.div
        animate={animation}
        className="w-20 h-20 rounded-full glass-accent flex items-center justify-center relative z-10"
        style={{
          borderColor: colors.core,
          boxShadow: `0 0 25px ${colors.glow}, 0 0 50px ${colors.glow}`,
        }}
      >
        <motion.div
          className="w-12 h-12 rounded-full"
          style={{ backgroundColor: colors.core, filter: 'blur(4px)' }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </div>
  )
}
