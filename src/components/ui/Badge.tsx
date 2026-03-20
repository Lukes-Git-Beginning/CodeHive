import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  className?: string
}

const variants = {
  default: 'bg-bg-elevated text-text-secondary border-border',
  accent: 'bg-accent-dim text-accent border-accent/20',
  success: 'bg-success-dim text-success border-success/20',
  warning: 'bg-warning-dim text-warning border-warning/20',
  danger: 'bg-danger-dim text-danger border-danger/20',
}

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${variants[variant]} ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
