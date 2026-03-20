import type { ReactNode } from 'react'

interface AvatarProps {
  icon?: ReactNode
  initials?: string
  size?: 'sm' | 'md' | 'lg'
  status?: 'active' | 'idle' | 'error' | 'none'
  className?: string
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
}

const statusColors = {
  active: 'bg-success',
  idle: 'bg-text-muted',
  error: 'bg-danger',
  none: '',
}

const statusSizes = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
}

export function Avatar({ icon, initials, size = 'md', status = 'none', className = '' }: AvatarProps) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`
          ${sizes[size]}
          rounded-full flex items-center justify-center
          bg-accent-dim text-accent border border-accent/20
          font-medium
        `}
      >
        {icon || initials || '?'}
      </div>
      {status !== 'none' && (
        <span
          className={`
            absolute -bottom-0.5 -right-0.5 rounded-full
            ${statusSizes[size]} ${statusColors[status]}
            border-2 border-bg-deep
          `}
        />
      )}
    </div>
  )
}
