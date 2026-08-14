import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type EmptyStateProps = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

// DESIGN.md : bordure 1.5px pointillée, radius 20, icône colorée 52px, CTA primaire.
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-[1.5px] border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-13 items-center justify-center rounded-xl bg-primary text-white">
        {icon}
      </span>
      <span className="text-card font-semibold text-ink">{title}</span>
      {description && <span className="max-w-xs text-body text-ink-muted">{description}</span>}
      {action}
    </div>
  )
}
