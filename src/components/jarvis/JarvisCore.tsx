import { motion } from 'framer-motion'
import { useAgentStore } from '../../stores/agentStore'
import type { AgentInstance } from '../../types/agent'

const EMPTY_AGENTS: AgentInstance[] = []

const PHASE_COLORS: Record<string, { core: string; glow: string; ring: string; nebula1: string; nebula2: string }> = {
  idle:               { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.25)',  ring: 'rgba(0, 212, 255, 0.15)',  nebula1: '#00d4ff', nebula2: '#1a8fff' },
  planning:           { core: '#1a8fff', glow: 'rgba(26, 143, 255, 0.3)',  ring: 'rgba(26, 143, 255, 0.25)', nebula1: '#1a8fff', nebula2: '#00d4ff' },
  awaiting_approval:  { core: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)',   ring: 'rgba(255, 170, 0, 0.25)',  nebula1: '#ffaa00', nebula2: '#ff8800' },
  executing:          { core: '#7b61ff', glow: 'rgba(123, 97, 255, 0.4)',  ring: 'rgba(123, 97, 255, 0.3)',  nebula1: '#7b61ff', nebula2: '#00d4ff' },
  verifying:          { core: '#00d4ff', glow: 'rgba(0, 212, 255, 0.3)',   ring: 'rgba(0, 212, 255, 0.25)',  nebula1: '#00d4ff', nebula2: '#00ff88' },
  done:               { core: '#00ff88', glow: 'rgba(0, 255, 136, 0.5)',   ring: 'rgba(0, 255, 136, 0.3)',   nebula1: '#00ff88', nebula2: '#00d4ff' },
  error:              { core: '#ff3366', glow: 'rgba(255, 51, 102, 0.5)',  ring: 'rgba(255, 51, 102, 0.3)',  nebula1: '#ff3366', nebula2: '#ff6644' },
}

// Generate random star positions once (module-level for stability)
const STARS = Array.from({ length: 40 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.5 + 0.5,
  delay: Math.random() * 3,
  duration: Math.random() * 2 + 2,
}))

// Particle configs
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  angle: (i * 15 * Math.PI) / 180,
  delay: i * 0.2,
  distance: 80 + Math.random() * 60,
  size: Math.random() * 2 + 1,
  duration: 2.5 + Math.random() * 2,
}))

export function JarvisCore() {
  const phase = useAgentStore((s) => s.phase)
  const currentWave = useAgentStore((s) => s.currentWave)
  const totalWaves = useAgentStore((s) => s.totalWaves)
  const agents = useAgentStore((s) => s.currentRun?.agents ?? EMPTY_AGENTS)
  const colors = PHASE_COLORS[phase] || PHASE_COLORS.idle
  const isActive = phase !== 'idle' && phase !== 'done'

  return (
    <div className="relative flex items-center justify-center w-80 h-80 shrink-0" style={{ marginBottom: '3rem' }}>

      {/* 1. Particles — emitting outward from center */}
      {isActive && PARTICLES.map((p, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: colors.core,
            left: 'calc(50% - 1px)',
            top: 'calc(50% - 1px)',
          }}
          animate={{
            x: [0, Math.cos(p.angle) * p.distance],
            y: [0, Math.sin(p.angle) * p.distance],
            opacity: [0.6, 0],
            scale: [1, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* 2. Outer ambient glow — large soft background */}
      <motion.div
        key={`glow-${phase}`}
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{ duration: isActive ? 2.5 : 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          backgroundColor: colors.glow,
          filter: 'blur(60px)',
        }}
      />

      {/* 3. Outer ring — smooth, breathing */}
      <motion.div
        animate={{
          rotate: isActive ? [0, 360] : 0,
          scale: [1, 1.02, 1],
        }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
          scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute rounded-full"
        style={{
          width: 260,
          height: 260,
          border: `1px solid ${colors.ring}`,
          boxShadow: isActive ? `0 0 12px ${colors.ring}` : 'none',
        }}
      />

      {/* 4. Middle ring — dashed, counter-rotate */}
      <motion.div
        animate={{ rotate: isActive ? [0, -360] : 0 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute rounded-full"
        style={{
          width: 220,
          height: 220,
          border: `1px dashed ${colors.ring}`,
          opacity: 0.5,
        }}
      />

      {/* 5. Inner ring — pulsing */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.06, 1] : [1, 1.02, 1],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{ duration: isActive ? 2 : 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full"
        style={{
          width: 180,
          height: 180,
          border: `1px solid ${colors.ring}`,
        }}
      />

      {/* 6. Nebula orb container */}
      <motion.div
        key={`core-${phase}`}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{
          scale: isActive ? [1, 1.06, 1] : [1, 1.03, 1],
        }}
        transition={{ duration: isActive ? 2 : 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-full overflow-hidden flex items-center justify-center z-10"
        style={{
          width: 140,
          height: 140,
          border: `1.5px solid ${colors.core}40`,
          boxShadow: `
            0 0 30px ${colors.glow},
            0 0 60px ${colors.glow},
            0 0 100px ${colors.glow},
            inset 0 0 40px ${colors.glow}
          `,
        }}
      >
        {/* 6a. Deep space background with stars */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 50%, #141828 0%, #0a0e1a 100%)`,
          }}
        />

        {/* 6b. Star field */}
        {STARS.map((star, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute rounded-full"
            style={{
              width: star.size,
              height: star.size,
              backgroundColor: 'white',
              left: `${star.x}%`,
              top: `${star.y}%`,
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* 6c. Nebula cloud layer 1 — slow clockwise */}
        <motion.div
          className="absolute inset-[-20%] rounded-full"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          style={{
            background: `conic-gradient(from 0deg, transparent, ${colors.nebula1}70, transparent, ${colors.nebula2}50, transparent)`,
            filter: 'blur(8px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* 6d. Nebula cloud layer 2 — faster counter-clockwise */}
        <motion.div
          className="absolute inset-[-10%] rounded-full"
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          style={{
            background: `conic-gradient(from 120deg, transparent, ${colors.nebula2}60, transparent, ${colors.nebula1}40, transparent, ${colors.nebula2}50, transparent)`,
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* 6e. Nebula cloud layer 3 — slow orbit */}
        <motion.div
          className="absolute inset-[5%] rounded-full"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          style={{
            background: `conic-gradient(from 240deg, transparent 30%, ${colors.core}45, transparent 50%, ${colors.nebula1}35, transparent 70%)`,
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
          }}
        />

        {/* 6f. Core bright center */}
        <motion.div
          className="absolute rounded-full"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{ duration: isActive ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 56,
            height: 56,
            background: `radial-gradient(circle, ${colors.core}cc, ${colors.core}60, transparent)`,
            filter: 'blur(10px)',
          }}
        />

        {/* 6g. Hot white center point */}
        <motion.div
          className="absolute rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 18,
            height: 18,
            background: 'radial-gradient(circle, white 0%, rgba(255,255,255,0.6) 40%, transparent 70%)',
            filter: 'blur(2px)',
          }}
        />

        {/* 6h. "AI CORE" label */}
        <motion.span
          className="absolute font-hud text-[8px] tracking-widest holo-text z-20"
          style={{ color: colors.core }}
          animate={{ opacity: isActive ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          AI CORE
        </motion.span>
      </motion.div>

      {/* 7. Data readouts */}
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ top: -8 }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {phase.toUpperCase().replace('_', ' ')}
        </span>
      </div>
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ bottom: -8 }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {currentWave > 0 ? `WAVE ${currentWave}/${totalWaves}` : 'STANDBY'}
        </span>
      </div>
      <div className="absolute font-hud text-[7px] tracking-wider" style={{ right: -36, top: '50%', transform: 'translateY(-50%)' }}>
        <span style={{ color: colors.core, opacity: 0.7 }}>
          {agents.length > 0 ? `${agents.length} AGT` : '\u2014'}
        </span>
      </div>
    </div>
  )
}
