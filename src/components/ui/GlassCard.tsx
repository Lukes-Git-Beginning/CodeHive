import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  title?: string
  glowing?: boolean
  className?: string
  animate?: boolean
}

export function GlassCard({ children, title, glowing, className = '', animate = true }: GlassCardProps) {
  const Wrapper = animate ? motion.div : 'div'
  const animateProps = animate
    ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }
    : {}

  return (
    <Wrapper
      {...animateProps}
      className={`
        relative rounded-xl overflow-hidden
        ${glowing ? 'glass-accent' : 'glass'}
        ${className}
      `}
    >
      {title && (
        <div className="px-4 pt-3 pb-2">
          <h3 className="font-hud text-xs text-accent text-glow-green">{title}</h3>
        </div>
      )}
      <div className={title ? 'px-4 pb-4' : 'p-4'}>{children}</div>
    </Wrapper>
  )
}
