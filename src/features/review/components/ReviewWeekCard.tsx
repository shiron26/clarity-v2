import { RocketIcon } from '../../../components/icons/RocketIcon'
import { cn } from '../../../lib/cn'
import { RATING_COLORS } from '../../../lib/reviewRating'
import { weekDatesLabel } from '../reviewPeriod'
import type { IsoDate } from '../../../lib/appDate'

export type WeekCardObjective = { id: string; title: string; rating: number | undefined }

type ReviewWeekCardProps = {
  weekNo: number
  monday: IsoDate
  objectives: WeekCardObjective[]
  selected: boolean
  current: boolean
  future: boolean
  onSelect: () => void
}

/**
 * Une semaine du trimestre : son numéro, ses dates, et une fusée par objectif
 * jugé — colorée si la note est posée, fantôme sinon. La coche verte n'apparaît
 * que quand plus rien ne manque.
 */
export function ReviewWeekCard({
  weekNo,
  monday,
  objectives,
  selected,
  current,
  future,
  onSelect,
}: ReviewWeekCardProps) {
  const strong = selected || current
  const rated = objectives.length > 0 && objectives.every((o) => o.rating !== undefined)

  return (
    <button
      type="button"
      disabled={future}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center rounded-xl px-4.5 py-5 transition-all duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        future ? 'cursor-default border-[1.5px] border-dashed border-[#e3e2dc]' : 'cursor-pointer bg-surface',
        !future && selected && 'border-2 border-primary',
        !future && !selected && current && 'border-2 border-[#f5a524]',
        !future && !selected && !current && 'border border-border hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'text-center text-[15px]',
          strong ? 'font-bold text-ink' : 'font-semibold text-[#c2c2ba]',
        )}
      >
        S{weekNo}
      </span>
      <span
        className={cn(
          'mt-0.5 text-center text-[11px]',
          strong ? 'text-ink-3' : 'text-[#c9c9c2]',
        )}
      >
        {weekDatesLabel(monday)}
      </span>

      <div className="mt-4 flex gap-2.5">
        {objectives.map((o) => (
          <RocketIcon
            key={o.id}
            className="size-[18px] shrink-0"
            style={{
              color: o.rating
                ? RATING_COLORS[o.rating]
                : future
                  ? '#f0efe9'
                  : '#e3e2dc',
            }}
          />
        ))}
      </div>

      <div className="mt-3.5 flex min-h-5 items-center justify-center">
        {!future &&
          (rated ? (
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-[#12b76a]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9.5" />
            </svg>
          ) : (
            <span className="text-[14px] leading-none text-[#c9c9c2]">—</span>
          ))}
      </div>
    </button>
  )
}
