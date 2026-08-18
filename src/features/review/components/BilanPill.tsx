import { Link } from 'react-router'
import { cn } from '../../../lib/cn'
import { bilanPath, quarterFullLabel } from '../../../lib/quarterLabels'
import { reviewStatus } from '../../../lib/reviewPeriod'

type BilanPillProps = {
  year: number
  quarter: number
  openAt: string | undefined
  isOpen: boolean
  validatedAt: string | null
  /** Le trimestre a-t-il porté un objectif ? Sans sujet, pas de bilan. */
  hasSubjects: boolean
  className?: string
}

/**
 * L'état du bilan du trimestre, posé à côté du rendez-vous hebdomadaire.
 *
 * Les deux cérémonies ne se ressemblent pas — l'une constate la semaine,
 * l'autre décide de la suite — mais elles se lisent sur le même calendrier :
 * savoir quand la seconde s'ouvre évite de la chercher.
 *
 * Verrouillée, la pastille est un texte inerte et non un lien mort : la date
 * d'ouverture est déjà écrite, le clic n'apprendrait rien de plus.
 */
export function BilanPill({
  year,
  quarter,
  openAt,
  isOpen,
  validatedAt,
  hasSubjects,
  className,
}: BilanPillProps) {
  const status = reviewStatus({ openAt, isOpen, validatedAt, hasSubjects })
  const label = `Bilan du ${quarterFullLabel(quarter).toLowerCase()}`

  const base =
    'flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-label font-medium whitespace-nowrap'

  if (!status.actionable) {
    return (
      <span className={cn(base, 'border-border bg-surface text-ink-muted', className)}>
        {label} · {status.meta.toLowerCase()}
        {/* Le cadenas dit « pas encore », pas « rien à faire » : un trimestre sans
            objectif n'est pas verrouillé, il est vide. */}
        {status.reason === 'locked' && (
          <span aria-hidden className="text-body">
            🔒
          </span>
        )}
      </span>
    )
  }

  const done = validatedAt !== null

  return (
    <Link
      to={bilanPath(year, { type: 'quarter', quarter })}
      className={cn(
        base,
        'transition-colors duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        done
          ? 'border-border-ok bg-surface text-ink-2'
          : 'border-border bg-surface text-ink-2 hover:border-primary hover:text-primary',
        className,
      )}
    >
      {label} · {done ? 'fait' : 'à faire'}
      <span aria-hidden>{done ? '✓' : '→'}</span>
    </Link>
  )
}
