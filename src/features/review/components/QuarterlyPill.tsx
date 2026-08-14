import { cn } from '../../../lib/cn'
import { openingDateLabel } from '../reviewPeriod'

type QuarterlyPillProps = {
  quarter: number
  /** Instant d'ouverture, tel que rendu par `public.review_openings`. */
  openAt: string | undefined
  isOpen: boolean
  done: boolean
  onOpen: () => void
  className?: string
}

/**
 * L'état du bilan du trimestre, en une phrase.
 *
 * Trois états, jamais deux à la fois : verrouillé jusqu'à sa date d'ouverture
 * (dernier vendredi du trimestre, 18h — SPEC §4.4), ouvert et à faire, ou fait.
 * La date affichée vient du serveur : c'est lui qui connaît le fuseau.
 */
export function QuarterlyPill({
  quarter,
  openAt,
  isOpen,
  done,
  onOpen,
  className,
}: QuarterlyPillProps) {
  const base =
    'flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-label font-medium whitespace-nowrap'

  if (!isOpen) {
    return (
      <span
        className={cn(base, 'border-border bg-surface text-ink-muted', className)}
        title={openAt ? `Ouvre le ${openingDateLabel(openAt)} à 18h` : undefined}
      >
        Bilan Q{quarter} · verrouillé{openAt ? ` jusqu’au ${openingDateLabel(openAt)}` : ''}
        <span aria-hidden className="text-[12px]">
          🔒
        </span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        base,
        'cursor-pointer transition-colors duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        done
          ? 'border-border-ok bg-surface text-ink-2'
          : 'border-border bg-surface text-ink-2 hover:border-primary hover:text-primary',
        className,
      )}
    >
      Bilan Q{quarter} · {done ? 'fait' : 'à faire'}
      <span aria-hidden>{done ? '✓' : '→'}</span>
    </button>
  )
}
