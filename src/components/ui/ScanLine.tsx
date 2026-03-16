import { motion } from 'framer-motion'

interface ScanLineProps {
  color?: string
  duration?: number
}

export function ScanLine({ color = 'rgba(0, 255, 136, 0.4)', duration = 3 }: ScanLineProps) {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none z-50"
      style={{
        background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
      }}
      animate={{ top: ['0%', '100%'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    />
  )
}
