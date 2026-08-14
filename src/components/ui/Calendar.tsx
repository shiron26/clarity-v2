import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  addDays,
  addMonths,
  endOfWeek,
  formatLongDate,
  formatMonthYear,
  monthGrid,
  sameMonth,
  startOfMonth,
  startOfWeek,
  WEEK_HEADERS,
  type IsoDate,
} from '../../lib/appDate'
import { cn } from '../../lib/cn'

type CalendarProps = {
  value: IsoDate | null
  onChange: (value: IsoDate) => void
  /**
   * Ancre serveur (`useAppToday`) : entoure le jour courant et sert de mois par
   * défaut quand rien n'est sélectionné. Jamais `new Date()` — le fuseau est celui
   * de l'application, pas celui du navigateur (SPEC §2).
   */
  today: IsoDate
  /** `sm` = cellules 26 px (desktop), `lg` = 38 px (mobile). */
  size?: 'sm' | 'lg'
  label?: string
  className?: string
}

/**
 * Grille de mois de la maquette. Primitive pure : elle ne connaît ni les tâches ni
 * les échéances, seulement des chaînes `YYYY-MM-DD`.
 *
 * Le mois affiché est un **état interne**, dérivé du jour focusé. Tous les appelants
 * démontent le calendrier à la fermeture (popover fermé, section repliée), donc rien
 * à resynchroniser : n'ajoutez pas d'effet de synchro sur `value`, il se battrait
 * avec la navigation de l'utilisateur.
 */
export function Calendar({
  value,
  onChange,
  today,
  size = 'sm',
  label = 'Choisir une date',
  className,
}: CalendarProps) {
  const titleId = useId()
  const [focused, setFocused] = useState<IsoDate>(value ?? today)
  const gridRef = useRef<HTMLTableElement>(null)
  // Le focus DOM ne suit `focused` que lorsque c'est le clavier qui l'a déplacé :
  // au montage c'est le popover qui donne le focus, et un clic l'a déjà.
  const followFocus = useRef(false)

  const month = startOfMonth(focused)
  const cells = monthGrid(month)
  const large = size === 'lg'

  useEffect(() => {
    if (!followFocus.current) return
    followFocus.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-iso="${focused}"]`)?.focus()
  }, [focused])

  function move(next: IsoDate) {
    followFocus.current = true
    setFocused(next)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTableElement>) {
    const moves: Record<string, () => IsoDate> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => startOfWeek(focused),
      End: () => endOfWeek(focused),
      PageUp: () => addMonths(month, -1),
      PageDown: () => addMonths(month, 1),
    }
    const next = moves[event.key]
    if (!next) return
    event.preventDefault()
    move(next())
  }

  const navClass = cn(
    'flex shrink-0 cursor-pointer items-center justify-center transition-colors duration-150',
    'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
    large
      ? 'size-10 rounded-lg bg-canvas text-[15px] text-ink-2'
      : 'size-[26px] rounded-sm text-ink-3 hover:bg-canvas',
  )

  return (
    <div role="group" aria-label={label} className={className}>
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mois précédent"
          onClick={() => setFocused(addMonths(month, -1))}
          className={navClass}
        >
          <span aria-hidden>‹</span>
        </button>
        <h3
          id={titleId}
          aria-live="polite"
          className={cn('font-semibold text-ink', large ? 'text-[14px]' : 'text-body')}
        >
          {formatMonthYear(month)}
        </h3>
        <button
          type="button"
          aria-label="Mois suivant"
          onClick={() => setFocused(addMonths(month, 1))}
          className={navClass}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full border-separate border-spacing-0.5"
      >
        <thead>
          <tr>
            {WEEK_HEADERS.map((day) => (
              <th
                key={day.short}
                scope="col"
                abbr={day.long}
                className={cn(
                  'font-semibold tracking-[0.6px] text-ink-muted',
                  large ? 'h-6 text-[9.5px]' : 'h-[22px] text-micro',
                )}
              >
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {cells
                .slice(week * 7, week * 7 + 7)
                .map((iso) => {
                  const selected = iso === value
                  const isToday = iso === today
                  const outside = !sameMonth(iso, month)

                  return (
                    <td key={iso} className="p-0 text-center">
                      <button
                        type="button"
                        data-iso={iso}
                        data-autofocus={iso === focused ? '' : undefined}
                        tabIndex={iso === focused ? 0 : -1}
                        aria-label={formatLongDate(iso)}
                        aria-current={isToday ? 'date' : undefined}
                        // `aria-selected` n'est pas valide sur un bouton : la
                        // cellule sélectionnée s'annonce comme un bouton pressé.
                        aria-pressed={selected}
                        onClick={() => {
                          setFocused(iso)
                          onChange(iso)
                        }}
                        className={cn(
                          'mx-auto flex cursor-pointer items-center justify-center rounded-full border border-transparent',
                          'transition-colors duration-150 hover:bg-surface-subtle',
                          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                          // `w-full max-w-…` plutôt qu'une taille fixe : sous 360 px
                          // de large, sept cellules de 38 px déborderaient de la feuille.
                          large
                            ? 'h-[38px] w-full max-w-[38px] text-ui'
                            : 'h-[26px] w-full max-w-[26px] text-label',
                          selected && 'bg-primary-soft font-semibold text-primary',
                          !selected && isToday && 'border-[#a9beff] font-semibold text-primary',
                          !selected && !isToday && (outside ? 'text-[#c9c9c2]' : 'text-ink'),
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    </td>
                  )
                })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
