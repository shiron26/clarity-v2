import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AlertProps = {
  children: ReactNode
  variant?: 'danger' | 'info'
  className?: string
}

const VARIANTS = {
  danger: 'bg-danger-bg text-danger',
  info: 'bg-surface-subtle text-ink-2',
}

export function Alert({ children, variant = 'danger', className }: AlertProps) {
  return (
    <p
      role="alert"
      className={cn('rounded-lg px-4 py-3 text-body leading-relaxed', VARIANTS[variant], className)}
    >
      {children}
    </p>
  )
}
