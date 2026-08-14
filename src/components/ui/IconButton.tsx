import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  // Bouton sans texte : le libellé accessible est obligatoire.
  label: string
  children: ReactNode
}

// Dérivé carré du bouton secondaire (28×28, radius 9) — DESIGN.md « bouton icône ».
export function IconButton({ label, className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm',
        'bg-field text-ink-2 transition-colors duration-150',
        'hover:bg-border-strong',
        'active:translate-y-px',
        'outline-none focus-visible:ring-3 focus-visible:ring-primary/32',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
