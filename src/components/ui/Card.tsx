import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

// DESIGN.md : fond blanc, radius 20, ombre diffuse, jamais de bordure.
export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('rounded-2xl bg-surface p-5 shadow-card', className)} {...rest}>
      {children}
    </div>
  )
}
