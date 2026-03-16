import { motion } from 'framer-motion'

type Status = 'online' | 'busy' | 'idle' | 'error'

const statusColors: Record<Status, string> = {
  online: '#00ff88',
  busy: '#00d4ff',
  idle: 'rgba(255,255,255,0.35)',
  error: '#ff3366',
}

interface StatusDotProps {
  status: Status
  size?: number
  pulse?: boolean
}

export function StatusDot({ status, size = 8, pulse = true }: StatusDotProps) {
  const color = statusColors[status]

  return (
    <motion.div
      className="rounded-full shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      animate={
        pulse && status !== 'idle'
          ? {
              boxShadow: [
                `0 0 ${size / 2}px ${color}`,
                `0 0 ${size * 1.5}px ${color}`,
                `0 0 ${size / 2}px ${color}`,
              ],
            }
          : undefined
      }
      transition={pulse ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    />
  )
}
