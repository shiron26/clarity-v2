import { ReviewWeekCard, type WeekCardObjective } from './ReviewWeekCard'
import { quarterRatingKey, type QuarterRatings } from '../../../hooks/useQuarterRatings'
import type { Objective } from '../../../hooks/useObjectives'
import type { IsoDate, WeekRef } from '../../../lib/appDate'

type ReviewWeekGridProps = {
  weeks: WeekRef[]
  objectives: Objective[]
  ratings: QuarterRatings
  selectedWeek: number | undefined
  currentWeek: number | undefined
  /** Ancre serveur : une semaine qui commence après aujourd'hui n'est pas vécue. */
  today: IsoDate
  onSelectWeek: (weekNo: number) => void
}

/**
 * Les treize semaines du trimestre, d'un coup d'œil.
 *
 * C'est la vue d'ensemble que la review hebdo produit avec le temps : chaque
 * carte porte une fusée par objectif, et la grille montre les trous autant que
 * les réussites.
 */
export function ReviewWeekGrid({
  weeks,
  objectives,
  ratings,
  selectedWeek,
  currentWeek,
  today,
  onSelectWeek,
}: ReviewWeekGridProps) {
  return (
    <section>
      <h2 className="mb-2.5 px-0.5 text-[9.5px] font-semibold tracking-[1.2px] text-ink-muted lg:text-[10px] lg:tracking-[1.3px]">
        SEMAINES DU TRIMESTRE
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3.5">
        {weeks.map(({ weekNo, isoYear, monday }) => {
          const cardObjectives: WeekCardObjective[] = objectives.map((o) => ({
            id: o.id,
            title: o.title,
            rating: ratings.get(quarterRatingKey(o.id, isoYear, weekNo)),
          }))

          return (
            <ReviewWeekCard
              key={monday}
              weekNo={weekNo}
              monday={monday}
              objectives={cardObjectives}
              selected={weekNo === selectedWeek}
              current={weekNo === currentWeek}
              future={monday > today}
              onSelect={() => onSelectWeek(weekNo)}
            />
          )
        })}
      </div>
    </section>
  )
}
