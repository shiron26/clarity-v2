import { ObjectiveQuarterRow, QUARTER_GRID } from './ObjectiveQuarterRow'
import { cn } from '../../../lib/cn'
import { quarterMonthLabels } from '../yearContent'
import type { QuarterLine } from '../quarterLines'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'

const BAND = 'border-t border-surface-subtle px-4.5 lg:px-5.5'

type QuarterBoardProps = {
  lines: QuarterLine[]
  quarter: number
  privacy: boolean
}

/**
 * Le corps du trimestre : une ligne par objectif, les secondaires à part.
 *
 * Ils ont leur propre bande et leur propre intertitre plutôt qu'une simple
 * opacité au milieu des autres : on comprend **pourquoi** ils sont atténués au
 * lieu de le subir.
 */
export function QuarterBoard({ lines, quarter, privacy }: QuarterBoardProps) {
  const principals = lines.filter((line) => !line.secondary)
  const secondaries = lines.filter((line) => line.secondary)
  const months = quarterMonthLabels(quarter)

  return (
    <>
      {principals.length > 0 && (
        <div className={cn(BAND, 'pt-1 pb-2')}>
          {principals.map((line) => (
            <ObjectiveQuarterRow key={line.objective.id} line={line} privacy={privacy} />
          ))}
        </div>
      )}

      {secondaries.length > 0 && (
        <div className={cn(BAND, 'pt-4 pb-2')}>
          <h2 className={cn(SECTION_LABEL, 'mb-1')}>
            Secondaires
          </h2>
          {secondaries.map((line) => (
            <ObjectiveQuarterRow key={line.objective.id} line={line} privacy={privacy} />
          ))}
        </div>
      )}

      {/* Les mois ferment la liste, alignés sur la colonne des frises : sans eux
          on ne sait pas à quelle part du trimestre une case correspond. */}
      <div className={cn(BAND, QUARTER_GRID, 'border-t-0 pt-1 pb-5')}>
        <div aria-hidden className="flex justify-around text-micro text-ink-muted">
          {months.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
        <span />
      </div>
    </>
  )
}
