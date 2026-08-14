import { addDays, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'

type DueQuickLinksProps = {
  value: IsoDate | null
  onChange: (value: IsoDate | null) => void
  /** Date du serveur — « Aujourd'hui » et « Demain » en dérivent. */
  today: IsoDate
  /** `link` = pied de calendrier desktop, `chip` = boutons pleine largeur mobile. */
  variant: 'link' | 'chip'
  /** Les actions rapides d'une ligne n'exposent qu'Aujourd'hui / Sans date. */
  showTomorrow?: boolean
}

/**
 * Raccourcis d'échéance posés sous une grille de mois. Ils ne dupliquent pas le
 * calendrier : ils donnent les deux ou trois dates qu'on ne veut pas aller chercher
 * à la souris, plus le seul moyen de *retirer* une date — qu'aucune cellule ne peut
 * exprimer.
 */
export function DueQuickLinks({
  value,
  onChange,
  today,
  variant,
  showTomorrow = true,
}: DueQuickLinksProps) {
  const tomorrow = addDays(today, 1)
  const chip = variant === 'chip'

  const options: { key: string; label: string; date: IsoDate | null; tone: 'primary' | 'neutral' | 'muted' }[] = [
    { key: 'today', label: 'Aujourd’hui', date: today, tone: 'primary' },
    ...(showTomorrow
      ? [{ key: 'tomorrow', label: 'Demain', date: tomorrow, tone: 'neutral' as const }]
      : []),
    { key: 'none', label: 'Sans date', date: null, tone: 'muted' },
  ]

  return (
    <div
      className={cn(
        'border-t border-surface-subtle',
        chip ? 'mt-3 flex gap-2 pt-3' : 'mt-3 flex items-center gap-3.5 pt-[11px]',
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.date}
          onClick={() => onChange(option.date)}
          className={cn(
            'cursor-pointer font-medium transition-colors duration-150',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            chip
              ? 'flex min-h-11 flex-1 items-center justify-center rounded-lg text-body'
              : 'rounded-xs text-label',
            chip && option.tone === 'primary' && 'bg-primary-soft text-primary',
            chip && option.tone === 'neutral' && 'bg-canvas text-ink-2',
            chip && option.tone === 'muted' && 'bg-canvas text-ink-muted',
            !chip && option.tone === 'primary' && 'text-primary',
            !chip && option.tone === 'neutral' && 'text-ink-3 hover:text-primary',
            !chip && option.tone === 'muted' && 'text-ink-muted hover:text-ink-3',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
