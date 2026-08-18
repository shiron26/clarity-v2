import { BilanPill } from './BilanPill'
import { RitualWeekGrid } from './RitualWeekGrid'
import { SegmentedGroup } from '../../../components/ui/SegmentedGroup'
import { YearStepper } from '../../../components/ui/YearStepper'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { QUARTERS, quarterTabLabel } from '../../../lib/quarterLabels'
import type { RitualBanner } from '../ritualContent'
import type { Review } from '../../../hooks/useReview'
import type { OpeningsByPeriod } from '../../../hooks/useReviewOpenings'
import type { IsoDate, IsoWeek, WeekRef } from '../../../lib/appDate'

type RitualHubProps = {
  year: number
  currentYear: number
  quarter: number
  currentQuarter: number | undefined
  weeks: WeekRef[]
  reviews: Map<string, Review> | undefined
  openings: OpeningsByPeriod | undefined
  today: IsoDate
  currentWeek: IsoWeek | undefined
  /** Le rendez-vous qu'annonce la bannière, ou `null` hors du trimestre vivant. */
  banner: RitualBanner | null
  quarterOpenAt: string | undefined
  quarterIsOpen: boolean
  quarterValidatedAt: string | null
  /** Le trimestre a-t-il porté un objectif ? Sans sujet, pas de bilan. */
  quarterHasSubjects: boolean
  /** Les lundis qui ont quelque chose à passer en revue — voir `RitualWeekGrid`. */
  reviewable: Set<IsoDate>
  onSelectYear: (year: number) => void
  onSelectQuarter: (quarter: number) => void
  onStartBanner: () => void
  onOpenWeek: (week: WeekRef) => void
}

/**
 * Le hub du rituel : où l'on est dans le trimestre, et par où l'on entre.
 *
 * Deux niveaux de lecture superposés — le rendez-vous qu'on s'apprête à tenir
 * (la carte sombre), et le trimestre entier derrière lui (la grille). La page
 * n'affiche plus une phrase seule quand il n'y a rien à faire : la bannière
 * énonce la date d'ouverture, à sa place, au-dessus de ce qui a déjà été fait.
 *
 * Composant muet : la bannière lui arrive déjà formée par `ritualBanner()`.
 */
export function RitualHub({
  year,
  currentYear,
  quarter,
  currentQuarter,
  weeks,
  reviews,
  openings,
  today,
  currentWeek,
  banner,
  quarterOpenAt,
  quarterIsOpen,
  quarterValidatedAt,
  quarterHasSubjects,
  reviewable,
  onSelectYear,
  onSelectQuarter,
  onStartBanner,
  onOpenWeek,
}: RitualHubProps) {
  const pill = (className: string) => (
    <BilanPill
      year={year}
      quarter={quarter}
      openAt={quarterOpenAt}
      isOpen={quarterIsOpen}
      validatedAt={quarterValidatedAt}
      hasSubjects={quarterHasSubjects}
      className={className}
    />
  )

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      <div className="flex flex-wrap items-center gap-3 lg:gap-4">
        <h1 className="text-title font-medium lg:text-h1 lg:font-semibold">Rituel</h1>

        <YearStepper
          year={year}
          currentYear={currentYear}
          onSelectYear={onSelectYear}
          className="ml-auto lg:ml-0"
        />

        {/* En mobile les onglets passent à la ligne, en pleine largeur : quatre
            libellés écrits ne tiennent pas à côté du titre sur 390 px. */}
        <SegmentedGroup
          label="Trimestre"
          value={String(quarter)}
          onChange={(value) => onSelectQuarter(Number(value))}
          options={QUARTERS.map((q) => ({
            value: String(q),
            label: quarterTabLabel(q, year === currentYear ? currentQuarter : undefined),
          }))}
          className="order-last w-full lg:order-none lg:w-auto"
        />

        {pill('hidden lg:ml-auto lg:flex')}
      </div>

      {banner && (
        <section className="flex flex-col gap-3.5 rounded-2xl bg-night px-5 py-4.5 text-white lg:flex-row lg:items-center lg:gap-4.5 lg:px-6.5 lg:py-5.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-card font-semibold">Rituel de la semaine</h2>
            <p className="mt-1 text-label leading-relaxed text-ink-onnight">{banner.meta}</p>
          </div>

          {banner.actionable ? (
            <button
              type="button"
              onClick={onStartBanner}
              className={buttonClasses({ className: 'shrink-0' })}
            >
              {banner.cta}
            </button>
          ) : (
            // La règle d'ouverture est énoncée juste à côté : un bouton éteint
            // n'aurait rien à apprendre de plus au clic.
            <span className="shrink-0 rounded-md bg-white/10 px-4 py-2.5 text-body font-medium text-ink-onnight">
              {banner.cta}
            </span>
          )}
        </section>
      )}

      {pill('justify-center lg:hidden')}

      <RitualWeekGrid
        weeks={weeks}
        reviews={reviews}
        openings={openings}
        today={today}
        currentWeek={currentWeek}
        reviewable={reviewable}
        onOpenWeek={onOpenWeek}
      />
    </div>
  )
}
