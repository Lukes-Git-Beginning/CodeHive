import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  title?: string
  className?: string
  animate?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export function Card({ children, title, className = '', animate = true, padding = 'md' }: CardProps) {
  const Wrapper = animate ? motion.div : 'div'
  const animateProps = animate
    ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } }
    : {}

  return (
    <Wrapper
      {...animateProps}
      className={`
        relative overflow-hidden rounded-xl
        bg-bg-surface border border-border
        shadow-card
        ${className}
      `}
    >
      {title && (
        <div className="px-4 pt-3 pb-2 border-b border-border">
          <h3 className="font-label text-sm text-text-primary">{title}</h3>
        </div>
      )}
      <div className={title ? paddings[padding] || 'p-4' : paddings[padding] || 'p-4'}>
        {children}
      </div>
    </Wrapper>
  )
}
