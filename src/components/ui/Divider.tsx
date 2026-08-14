import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type DividerProps = {
  label?: ReactNode
  className?: string
}

export function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cn('border-0 border-t border-border', className)} />
  }

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] text-ink-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
