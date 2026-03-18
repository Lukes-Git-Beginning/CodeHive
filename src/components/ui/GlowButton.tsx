import { motion } from 'framer-motion'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'danger' | 'ghost' | 'cyan' | 'hud'
  size?: 'sm' | 'md'
}

const variants = {
  primary: {
    base: 'bg-accent/15 border-accent/30 text-accent hover:bg-accent/25 hover:border-accent/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
    active: 'active:bg-accent/30',
  },
  danger: {
    base: 'bg-danger-dim border-danger/30 text-danger hover:bg-danger/25 hover:border-danger/50 hover:shadow-[0_0_20px_rgba(255,51,102,0.3)]',
    active: 'active:bg-danger/30',
  },
  ghost: {
    base: 'bg-transparent border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-border-accent',
    active: 'active:bg-bg-elevated',
  },
  cyan: {
    base: 'bg-cyan-dim border-cyan/30 text-cyan hover:bg-cyan/25 hover:border-cyan/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
    active: 'active:bg-cyan/30',
  },
  hud: {
    base: 'bg-transparent border-cyan/30 text-cyan hover:bg-cyan/10 hover:border-cyan/50 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]',
    active: 'active:bg-cyan/15',
  },
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

export function GlowButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}: GlowButtonProps) {
  const v = variants[variant]

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium border
        transition-all duration-200
        ${variant === 'hud' ? 'hud-panel font-hud tracking-wider' : 'rounded-lg'}
        ${v.base} ${v.active} ${sizes[size]}
        disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none
        ${className}
      `}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
