import { RitualWeekCard } from './RitualWeekCard'
import { weekReviewKey, type Review } from '../../../hooks/useReview'
import { openingKey, type OpeningsByPeriod } from '../../../hooks/useReviewOpenings'
import type { IsoDate, IsoWeek, WeekRef } from '../../../lib/appDate'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { cn } from '../../../lib/cn'

type RitualWeekGridProps = {
  weeks: WeekRef[]
  /** Les sessions déjà ouvertes, indexées par `weekReviewKey`. */
  reviews: Map<string, Review> | undefined
  openings: OpeningsByPeriod | undefined
  /** Ancre serveur : une semaine qui commence après aujourd'hui n'est pas vécue. */
  today: IsoDate
  /** La semaine vécue — le couple (année ISO, numéro), jamais le numéro seul. */
  currentWeek: IsoWeek | undefined
  /**
   * Les lundis des semaines qui ont au moins un objectif à passer en revue
   * (`objectivesForWeek`, décidé par la page : la grille ne connaît pas les
   * objectifs). Les autres ne s'ouvrent pas — un rituel sans sujet reste bloqué
   * sur un écran vide.
   */
  reviewable: Set<IsoDate>
  onOpenWeek: (week: WeekRef) => void
}

/**
 * Les treize semaines du trimestre, d'un coup d'œil.
 *
 * C'est la vue d'ensemble que le rendez-vous hebdomadaire produit avec le
 * temps : la grille montre les trous autant que les semaines tenues, et chaque
 * carte rouvre la sienne.
 */
export function RitualWeekGrid({
  weeks,
  reviews,
  openings,
  today,
  currentWeek,
  reviewable,
  onOpenWeek,
}: RitualWeekGridProps) {
  return (
    <section>
      <h2 className={cn(SECTION_LABEL, 'mb-2.5 px-0.5')}>
        Semaines du trimestre
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3.5">
        {weeks.map((week) => {
          const review = reviews?.get(weekReviewKey(week.isoYear, week.weekNo))
          const opening = openings?.get(openingKey('week', week.isoYear, week.weekNo))
          const future = week.monday > today
          // Le futur d'abord : une semaine à venir n'a pas encore d'objectif à
          // couvrir, et l'annoncer « sans objectif » serait un faux reproche.
          const nothing = !future && !reviewable.has(week.monday)

          return (
            <RitualWeekCard
              key={week.monday}
              weekNo={week.weekNo}
              monday={week.monday}
              done={review?.validated_at != null}
              current={
                week.isoYear === currentWeek?.isoYear && week.weekNo === currentWeek.isoWeek
              }
              future={future}
              nothing={nothing}
              openable={(opening?.isOpen ?? false) && !nothing}
              onOpen={() => onOpenWeek(week)}
            />
          )
        })}
      </div>
    </section>
  )
}
