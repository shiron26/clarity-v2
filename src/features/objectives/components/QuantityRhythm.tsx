import { Alert } from '../../../components/ui/Alert'
import { type ObjectiveRegularity } from '../../../hooks/useObjectiveRegularity'
import { regularityPercent } from '../../../lib/objectiveState'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { formatQuantity } from '../../../lib/objectiveWording'
import { observedRate, seriesLabels, type SeriesPoint } from '../../../lib/objectiveSeries'
import { ObjectiveRhythmBand, type RhythmStat } from './ObjectiveRhythmBand'
import { regularityStat } from '../regularityStat'
import { ObjectiveSparkline } from './ObjectiveSparkline'
import type { Objective } from '../../../hooks/useObjectives'
import type { PeriodUnit } from '../../../hooks/useObjectivePeriods'

/** Le fond de la bande sombre — le halo qui détache un point du trait. */
const NIGHT = '#17181f'

const AXIS_LABELS = 5

type QuantityRhythmProps = {
  objective: Objective
  regularity: ObjectiveRegularity | undefined
  /** `false` sur un secondaire : rien ne lui est demandé, donc rien à tenir. */
  showRegularity: boolean
  /**
   * La série, construite par le parent. Passée plutôt que rechargée ici : la
   * projection du héros la lit déjà, et deux `useObjectiveEntries` sur le même
   * objectif recalculaient `buildSeries` deux fois par rendu.
   */
  series: SeriesPoint[]
  entriesError: Error | null
}

/**
 * Le bloc de rythme d'une quantité : la moyenne, le nombre de saisies, la
 * courbe.
 *
 * Les saisies se chargent ici et pas dans la page : leur query key porte un
 * **seul** identifiant (`objectiveEntry.byObjective`), donc elle ne gagne rien à
 * remonter — contrairement aux lectures groupées, qui couvrent tous les
 * objectifs d'un coup.
 */
export function QuantityRhythm({
  objective,
  regularity,
  showRegularity,
  series,
  entriesError,
}: QuantityRhythmProps) {
  const skin = objectiveSkinOf(objective)
  const unit: PeriodUnit = objective.period_unit ?? 'month'
  const monthly = unit === 'month'

  const rate = observedRate(series, unit)
  const percent = regularity ? regularityPercent(regularity.done, regularity.target) : null

  const stats: RhythmStat[] = [
    {
      value:
        rate === null
          ? '—'
          : `${rate >= 0 ? '+ ' : '− '}${formatQuantity(Math.abs(rate), objective.unit)}`,
      label: monthly ? 'par mois' : 'par semaine',
    },
    showRegularity
      ? regularityStat(percent, unit, skin.ramp[1])
      : // Un secondaire n'a pas de régularité, et ce n'est pas une exception :
        // elle mesure « tenu sur attendu », et rien n'est attendu de lui.
        { value: '—', label: 'pas de régularité' },
  ]

  // `buildSeries` rend un point par saisie : la longueur de la série EST le
  // nombre de relevés.
  const count = series.length
  const footnote =
    count === 0
      ? 'Aucun relevé pour l’instant.'
      : `${count} relevé${count > 1 ? 's' : ''} saisi${count > 1 ? 's' : ''}.`

  // « Vos relevés » quand un rythme est attendu, « Vos saisies » sur un
  // secondaire : rien ne lui est demandé, et le mot « relevé » sous-entendrait
  // une échéance qui n'existe pas.
  const title = showRegularity ? 'Vos relevés' : 'Vos saisies'

  return (
    <ObjectiveRhythmBand title={title} stats={stats} footnote={footnote}>
      {entriesError ? (
        <Alert>{dataErrorMessage(entriesError)}</Alert>
      ) : (
        <ObjectiveSparkline
          points={series}
          mode={objective.entry_mode}
          color={skin.ramp[1]}
          dotColor={skin.ramp[4]}
          dotRing={NIGHT}
          labels={seriesLabels(series, AXIS_LABELS)}
          ariaLabel={`Évolution de ${objective.title}`}
        />
      )}
    </ObjectiveRhythmBand>
  )
}
