import { motion } from 'framer-motion'

interface ScanLineProps {
  color?: string
  duration?: number
  direction?: 'vertical' | 'horizontal'
}

export function ScanLine({ color = 'rgba(0, 212, 255, 0.4)', duration = 3, direction = 'vertical' }: ScanLineProps) {
  if (direction === 'horizontal') {
    return (
      <motion.div
        className="absolute top-0 bottom-0 w-px pointer-events-none z-50"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${color} 50%, transparent 100%)`,
        }}
        animate={{ left: ['0%', '100%'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    )
  }

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
