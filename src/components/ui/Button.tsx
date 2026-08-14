import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  children?: ReactNode
}

// DESIGN.md : jamais de bouton sans triplet hover / active / focus explicite.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-primary text-white shadow-primary',
    'hover:bg-primary-hover hover:shadow-primary-hover hover:-translate-y-px',
    'active:bg-primary-active active:shadow-primary-active active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    // Désactivé : plus d'accent bleu, plus d'ombre, plus de mouvement. La maquette
    // met du blanc sur gris (contraste ~1.9:1) — on garde un texte lisible à la place.
    'disabled:bg-field disabled:text-ink-muted disabled:shadow-none disabled:translate-y-0',
  ),
  secondary: cn(
    'bg-surface text-ink-2 border-[1.5px] border-border',
    'hover:border-border-strong',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    'disabled:text-ink-muted disabled:border-border disabled:translate-y-0',
  ),
  ghost: cn(
    'bg-transparent text-ink-3',
    'hover:bg-surface-subtle hover:text-ink',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    'disabled:text-ink-muted disabled:bg-transparent disabled:translate-y-0',
  ),
  danger: cn(
    'bg-transparent text-ink-muted',
    'hover:bg-danger-bg hover:text-danger',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-danger/28',
    'disabled:text-ink-muted disabled:bg-transparent disabled:translate-y-0',
  ),
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-body px-3 py-1.5 rounded-sm gap-1.5',
  md: 'text-body px-4 py-[9px] rounded-md gap-2',
  lg: 'text-ui px-[18px] py-[14px] rounded-lg gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center font-medium',
        'transition-[background-color,box-shadow,transform,border-color] duration-150',
        'outline-none focus-visible:outline-none',
        'disabled:cursor-default',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="size-3.5" />}
      {children}
    </button>
  )
}
