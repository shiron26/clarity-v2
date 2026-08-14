import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeProps = {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'accent' | 'onDark'
  className?: string
}

const TONES = {
  neutral: 'bg-field text-ink-2',
  primary: 'bg-primary text-white',
  accent: 'bg-accent-bg text-accent',
  onDark: 'bg-white/22 text-white',
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-2xl px-2 py-0.5 text-micro font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
