import { motion } from 'framer-motion'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary: {
    base: 'bg-accent text-white hover:bg-accent/90 shadow-card hover:shadow-elevated',
    active: 'active:bg-accent/80',
  },
  secondary: {
    base: 'bg-transparent border border-border-accent text-accent hover:bg-accent-dim hover:border-accent/40',
    active: 'active:bg-accent-dim',
  },
  ghost: {
    base: 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
    active: 'active:bg-bg-elevated',
  },
  danger: {
    base: 'bg-danger text-white hover:bg-danger/90 shadow-card hover:shadow-elevated',
    active: 'active:bg-danger/80',
  },
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const v = variants[variant]

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-200
        ${v.base} ${v.active} ${sizes[size]}
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none
        ${className}
      `}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
