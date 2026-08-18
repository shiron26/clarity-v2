import { QuarterCard } from './QuarterCard'
import type { Objective } from '../../../hooks/useObjectives'
import type { Opening } from '../../../hooks/useReviewOpenings'
import type { Review } from '../../../hooks/useReview'
import { QUARTERS } from '../../../lib/quarterLabels'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { cn } from '../../../lib/cn'

export type QuarterSummary = {
  quarter: number
  /** Les objectifs portés sur ce trimestre. */
  carried: Objective[]
  ahead: boolean
  current: boolean
  opening: Opening | undefined
  review: Review | undefined
}

type QuarterListProps = {
  year: number
  summaries: QuarterSummary[]
  privacy?: boolean
}

/**
 * Les quatre trimestres, en portes d'entrée.
 *
 * L'année et le trimestre ne se disputent plus le même écran : ici on lit le récit,
 * et on entre dans un trimestre pour en avoir le détail. Quatre cartes plutôt que
 * quatre lignes — une liste de lignes identiques ne dit pas où regarder, et c'est
 * la carte du trimestre en cours qui doit gagner.
 */
export function QuarterList({ year, summaries, privacy = false }: QuarterListProps) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={cn(SECTION_LABEL, 'px-0.5')}>
        Les quatre trimestres
      </h2>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {QUARTERS.map((quarter) => {
          const summary = summaries.find((s) => s.quarter === quarter)
          if (!summary) return null
          return (
            <QuarterCard
              key={quarter}
              year={year}
              summary={summary}
              privacy={privacy}
            />
          )
        })}
      </div>
    </section>
  )
}
