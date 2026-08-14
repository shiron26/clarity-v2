import { QuarterlyPill } from './QuarterlyPill'
import { ReviewWeekGrid } from './ReviewWeekGrid'
import { cn } from '../../../lib/cn'
import { quarterTitle, weekDatesLabel, weekTitle } from '../reviewPeriod'
import type { QuarterRatings } from '../../../hooks/useQuarterRatings'
import type { Objective } from '../../../hooks/useObjectives'
import type { IsoDate, WeekRef } from '../../../lib/appDate'

const QUARTERS = [1, 2, 3, 4]

type ReviewHubProps = {
  year: number
  currentYear: number
  quarter: number
  currentQuarter: number | undefined
  weeks: WeekRef[]
  selectedWeek: number | undefined
  selectedMonday: IsoDate | undefined
  currentWeek: number | undefined
  today: IsoDate
  objectives: Objective[]
  ratings: QuarterRatings
  ratedCount: number
  weekOpen: boolean
  quarterOpenAt: string | undefined
  quarterIsOpen: boolean
  quarterDone: boolean
  onSelectYear: (year: number) => void
  onSelectQuarter: (quarter: number) => void
  onSelectWeek: (weekNo: number) => void
  onStartWeek: () => void
  onStartQuarter: () => void
}

/**
 * Le hub : où l'on choisit ce que l'on va noter.
 *
 * Deux niveaux de lecture superposés — la semaine que l'on s'apprête à faire
 * (la carte sombre), et le trimestre entier derrière elle (la grille).
 */
export function ReviewHub({
  year,
  currentYear,
  quarter,
  currentQuarter,
  weeks,
  selectedWeek,
  selectedMonday,
  currentWeek,
  today,
  objectives,
  ratings,
  ratedCount,
  weekOpen,
  quarterOpenAt,
  quarterIsOpen,
  quarterDone,
  onSelectYear,
  onSelectQuarter,
  onSelectWeek,
  onStartWeek,
  onStartQuarter,
}: ReviewHubProps) {
  const total = objectives.length
  const canStart = weekOpen && !!selectedMonday && total > 0

  const startLabel =
    ratedCount === 0
      ? 'Commencer ma review →'
      : ratedCount < total
        ? 'Reprendre ma review →'
        : 'Revoir ma review →'

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      <div className="flex flex-wrap items-center gap-3 lg:gap-4">
        <h1 className="text-[22px] font-medium lg:text-h1 lg:font-semibold">Review</h1>

        <div className="ml-auto flex items-center gap-1 text-body text-ink-3 lg:ml-0 lg:gap-1.5">
          <button
            type="button"
            onClick={() => onSelectYear(year - 1)}
            aria-label={`Année ${year - 1}`}
            className="cursor-pointer rounded-xs px-1.5 py-1 hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            ◀
          </button>
          <span className="font-semibold text-ink">{year}</span>
          <button
            type="button"
            onClick={() => onSelectYear(year + 1)}
            disabled={year >= currentYear}
            aria-label={`Année ${year + 1}`}
            className={cn(
              'rounded-xs px-1.5 py-1 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              year >= currentYear
                ? 'cursor-default text-border-strong'
                : 'cursor-pointer hover:text-ink',
            )}
          >
            ▶
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Trimestre"
          className="order-last flex w-full gap-0.5 rounded-lg border border-border bg-surface p-1 lg:order-none lg:w-auto"
        >
          {QUARTERS.map((q) => {
            const active = q === quarter
            return (
              <button
                key={q}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectQuarter(q)}
                className={cn(
                  'flex-1 cursor-pointer rounded-sm px-3.5 py-1.5 text-label transition-all duration-150 lg:flex-none',
                  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                  active ? 'bg-night font-semibold text-white' : 'text-ink-3 hover:text-ink',
                )}
              >
                {quarterTitle(q, year === currentYear ? currentQuarter : undefined)}
              </button>
            )
          })}
        </div>

        <QuarterlyPill
          quarter={quarter}
          openAt={quarterOpenAt}
          isOpen={quarterIsOpen}
          done={quarterDone}
          onOpen={onStartQuarter}
          className="hidden lg:ml-auto lg:flex"
        />
      </div>

      {selectedWeek !== undefined && selectedMonday && (
        <div className="flex flex-col gap-3.5 rounded-2xl bg-[linear-gradient(120deg,#17181f,#232537)] p-4.5 text-white lg:flex-row lg:items-center lg:gap-4.5 lg:px-6.5 lg:py-5.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold lg:text-card">Review de la semaine</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-onnight lg:mt-0.5 lg:text-label">
              {weekTitle(selectedWeek, year === currentYear ? currentWeek : undefined)} ·{' '}
              {weekDatesLabel(selectedMonday)}
              <span className="lg:hidden">
                <br />
              </span>
              <span className="hidden lg:inline"> · </span>
              {ratedCount}/{total} objectif{total > 1 ? 's' : ''} noté{ratedCount > 1 ? 's' : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onStartWeek}
            disabled={!canStart}
            className={cn(
              'flex min-h-12 items-center justify-center rounded-[14px] px-5.5 text-ui font-medium transition-all duration-150 lg:ml-auto lg:min-h-0 lg:shrink-0 lg:rounded-lg lg:px-5.5 lg:py-3 lg:text-body',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              canStart
                ? 'cursor-pointer bg-primary text-white shadow-[0_8px_20px_rgb(0_68_224_/_0.35)] hover:-translate-y-px hover:bg-primary-hover active:translate-y-px active:bg-primary-active'
                : 'cursor-not-allowed bg-white/10 text-ink-onnight',
            )}
          >
            {total === 0
              ? 'Aucun objectif à noter'
              : weekOpen
                ? startLabel
                : 'Ouvre vendredi à 18h'}
          </button>
        </div>
      )}

      <QuarterlyPill
        quarter={quarter}
        openAt={quarterOpenAt}
        isOpen={quarterIsOpen}
        done={quarterDone}
        onOpen={onStartQuarter}
        className="justify-center lg:hidden"
      />

      <ReviewWeekGrid
        weeks={weeks}
        objectives={objectives}
        ratings={ratings}
        selectedWeek={selectedWeek}
        currentWeek={year === currentYear ? currentWeek : undefined}
        today={today}
        onSelectWeek={onSelectWeek}
      />
    </div>
  )
}
