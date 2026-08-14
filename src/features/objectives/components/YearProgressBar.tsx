import { cn } from '../../../lib/cn'
import { isoWeek, yearProgressPercent, type IsoDate } from '../../../lib/appDate'

type YearProgressBarProps = {
  today: IsoDate
  year: number
  currentQuarter: number
  selectedQuarter: number
  onSelectQuarter: (quarter: number) => void
}

const QUARTERS = [1, 2, 3, 4]

/**
 * Où en est l'année, et sélecteur de trimestre.
 *
 * Le pourcentage mesure le temps écoulé, pas une progression d'objectif : le
 * produit n'affiche jamais de score (SPEC §1). Il est calculé depuis la date
 * serveur, jamais depuis l'horloge du navigateur.
 */
export function YearProgressBar({
  today,
  year,
  currentQuarter,
  selectedQuarter,
  onSelectQuarter,
}: YearProgressBarProps) {
  const percent = yearProgressPercent(today)
  const week = isoWeek(today).isoWeek

  return (
    <section className="rounded-2xl bg-night px-4.5 py-4 sm:px-6 sm:py-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className="text-body font-semibold tracking-[1.3px] text-[#d5d6e0]">
          {year} · SEMAINE {week}
        </span>
        <span className="font-semibold text-white">
          {percent}
          <span className="text-[11px] font-medium text-ink-onnight">
            <span className="hidden sm:inline"> % de l’année</span>
            <span className="sm:hidden"> %</span>
          </span>
        </span>
      </div>

      <div className="relative h-[7px] rounded-xs bg-[#2a2b38]">
        <div
          className="absolute inset-y-0 left-0 rounded-xs bg-[linear-gradient(90deg,#0044e0,#2f8bff)]"
          style={{ width: `${percent}%` }}
        />
        <span
          className="absolute -top-[3.5px] size-3.5 -translate-x-[7px] rounded-full border-[3.5px] border-[#2f8bff] bg-white"
          style={{ left: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between">
        {QUARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelectQuarter(q)}
            aria-pressed={selectedQuarter === q}
            className={cn(
              'cursor-pointer rounded-2xl px-2.5 py-[3px] text-[10px] transition-colors duration-150',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              selectedQuarter === q
                ? 'bg-white/14 font-semibold text-white'
                : 'text-[#565866] hover:text-[#d5d6e0]',
            )}
          >
            Q{q}
            {q === currentQuarter && ' · en cours'}
          </button>
        ))}
      </div>
    </section>
  )
}
