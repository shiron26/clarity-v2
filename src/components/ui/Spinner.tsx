import { cn } from '../../lib/cn'

type SpinnerProps = {
  className?: string
  label?: string
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    >
      <span className="sr-only">{label ?? 'Chargement…'}</span>
    </span>
  )
}
