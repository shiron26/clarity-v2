import { ObjectiveHeatmap } from '../../../components/objectives/ObjectiveHeatmap'
import { type ObjectiveRegularity } from '../../../hooks/useObjectiveRegularity'
import { regularityPercent } from '../../../lib/objectiveState'
import { periodRef } from '../../../lib/objectivePeriod'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { ObjectiveRhythmBand, type RhythmStat } from './ObjectiveRhythmBand'
import { regularityStat } from '../regularityStat'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectivePeriod, PeriodUnit } from '../../../hooks/useObjectivePeriods'
import type { IsoDate } from '../../../lib/appDate'

type HabitRhythmProps = {
  objective: Objective
  /** Relevés de CET objectif, dans son unité. */
  periods: ObjectivePeriod[]
  regularity: ObjectiveRegularity | undefined
  activeDays: Set<string>
  /** Lundis à afficher — déjà tronqués à la date d'arrêt le cas échéant. */
  weeks: IsoDate[]
  quarter: number
  today: IsoDate
  /** `false` sur un objectif arrêté : plus rien n'est attendu de lui. */
  showRegularity: boolean
  privacy?: boolean
}

/**
 * Le bloc de rythme d'une habitude : deux chiffres et la grille de densité.
 *
 * Les deux chiffres remplacent la bande claire « Cette semaine » et le badge de
 * tendance : la période en cours d'un côté, la régularité glissante de l'autre.
 * Le détail du calcul n'est plus écrit — « 10/12 » sous un pourcentage disait
 * deux fois la même chose.
 */
export function HabitRhythm({
  objective,
  periods,
  regularity,
  activeDays,
  weeks,
  quarter,
  today,
  showRegularity,
  privacy = false,
}: HabitRhythmProps) {
  const skin = objectiveSkinOf(objective)
  const unit: PeriodUnit = objective.period_unit ?? 'week'

  const current = periodRef(unit, today)
  const currentPeriod = periods.find(
    (p) =>
      p.period_unit === unit &&
      p.period_year === current.periodYear &&
      p.period_index === current.periodIndex,
  )

  const target = currentPeriod?.target ?? objective.cadence ?? 1
  const done = currentPeriod?.done ?? 0
  const percent = regularity ? regularityPercent(regularity.done, regularity.target) : null
  const stopped = objective.closed_at !== null

  // Un objectif arrêté ne se lit pas au présent. « 0/2 cette semaine » y serait
  // faux — rien n'est attendu de lui — et le zéro se lirait comme un échec là où
  // il n'y a qu'une décision. On raconte ce qui a été tenu, au passé.
  const held = periods.filter((p) => p.period_unit === unit && p.done >= p.target).length
  const stats: RhythmStat[] = stopped
    ? [
        {
          value: String(held),
          label: unit === 'month' ? 'mois tenus' : 'semaines tenues',
        },
        { value: '—', label: 'depuis l’arrêt' },
      ]
    : [{ value: `${done}/${target}`, label: unit === 'month' ? 'ce mois-ci' : 'cette semaine' }]

  if (showRegularity) {
    stats.push(regularityStat(percent, unit, skin.ramp[1]))
  }

  // Un cumul, jamais un score : il ne peut structurellement pas baisser, ce qui
  // en fait la seule ligne qu'une absence ne peut pas abîmer. Compté sur CET
  // objectif — sommer les `done` de plusieurs objectifs compterait deux fois un
  // jour où deux d'entre eux ont avancé.
  const cumulated = periods.reduce((sum, p) => (p.period_unit === unit ? sum + p.done : sum), 0)
  const footnote =
    cumulated > 0
      ? `${cumulated} séance${cumulated > 1 ? 's' : ''} depuis le début de l’année`
      : undefined

  return (
    <ObjectiveRhythmBand title={`Régularité · T${quarter}`} stats={stats} footnote={footnote}>
      <ObjectiveHeatmap
        objective={objective}
        weeks={weeks}
        periods={periods}
        unit={unit}
        activeDays={activeDays}
        today={today}
        privacy={privacy}
        showDayLabels
        showMonthLabels
        showHeader={false}
      />
    </ObjectiveRhythmBand>
  )
}
