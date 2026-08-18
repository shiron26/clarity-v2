// Les cases d'un objectif sur un trimestre — la matière de `QuarterTimeline`.
//
// Dans un module à part et non dans le composant : un fichier de composant ne
// doit exporter que des composants (le fast refresh perd le fil sinon), et cette
// règle-ci est un choix produit — quelle unité pour quelle piste — pas un détail
// de rendu.
import { addMonths, quarterAnchor, type IsoDate, type WeekRef } from './appDate'
import { windowEnd, windowStart } from './objectiveFeasibility'
import { bySecondaryLast, heatLevel } from './objectiveState'
import type { Objective } from '../hooks/useObjectives'
import { indexPeriods, periodKey, type ObjectivePeriod } from '../hooks/useObjectivePeriods'

/** Une case : hors fenêtre, à venir, ou un cran de densité. */
export type QuarterCell =
  | { kind: 'outside' }
  | { kind: 'future' }
  | { kind: 'level'; level: number }

export type QuarterRow = { objective: Objective; cells: QuarterCell[] }

export type QuarterTimelineInput = {
  objectives: Objective[]
  periods: ObjectivePeriod[]
  weeks: WeekRef[]
  year: number
  quarter: number
  today: IsoDate | null
}

/**
 * Les cases d'un objectif dans **son** unité : treize semaines pour une habitude
 * hebdomadaire, trois mois pour un relevé mensuel.
 *
 * Les ramener toutes à la semaine inventerait une donnée hebdomadaire qui
 * n'existe pas en base — une case vaut une période réellement mesurée. Rend
 * `null` quand l'objectif n'était pas là : une piste vide n'apprend rien et se
 * lit comme un objectif délaissé (REFONTE §6).
 */
function cellsFor(
  objective: Objective,
  input: QuarterTimelineInput,
  byKey: Map<string, ObjectivePeriod>,
): QuarterCell[] | null {
  const { weeks, year, quarter, today } = input
  const unit = objective.period_unit
  if (unit === null) return null

  const start = windowStart(objective.year, objective.quarter)
  const end = windowEnd(objective.year, objective.quarter)
  // Un objectif arrêté ne montre pas de vide après lui : sa ligne s'arrête là où
  // la personne s'est arrêtée — même doctrine que `heatmapWindow`.
  const closed = objective.closed_at?.slice(0, 10)
  const last = closed !== undefined && closed < end ? closed : end

  const firstMonth = quarterAnchor(year, quarter)
  const quarterEnd = windowEnd(year, quarter)

  // Le recouvrement se juge sur le TRIMESTRE, pas sur la grille de semaines : la
  // première colonne commence au lundi de la semaine du 1er jour, qui appartient
  // souvent au trimestre précédent. Sans ce test, un objectif de T2 apparaîtrait
  // dans T3 pour ces deux jours-là — et une piste d'une case se lit comme un
  // objectif délaissé.
  if (last <= firstMonth || start >= quarterEnd) return null
  const slots =
    unit === 'week'
      ? weeks.map((w) => ({ from: w.monday, year: w.isoYear, index: w.weekNo }))
      : [0, 1, 2].map((offset) => {
          const from = addMonths(firstMonth, offset)
          return { from, year, index: Number(from.slice(5, 7)) }
        })

  const cells = slots.map((slot): QuarterCell => {
    if (slot.from < start || slot.from >= last) return { kind: 'outside' }
    if (today !== null && slot.from > today) return { kind: 'future' }
    const record = byKey.get(periodKey(objective.id, unit, slot.year, slot.index))
    return { kind: 'level', level: heatLevel(record?.done ?? 0, record?.target ?? 0) }
  })

  return cells.some((cell) => cell.kind !== 'outside') ? cells : null
}

/**
 * Les seules pistes à dessiner : celles qui ont vécu dans le trimestre, les
 * secondaires en dernier — comme ils ferment la frise annuelle.
 */
export function buildQuarterRows(input: QuarterTimelineInput): QuarterRow[] {
  const rows: QuarterRow[] = []
  // Un index, une fois : sans lui, chaque objectif rebalayait tout `periods`
  // pour chacune de ses 13 colonnes.
  const byKey = indexPeriods(input.periods)
  const ordered = [...input.objectives].sort(bySecondaryLast)
  for (const objective of ordered) {
    const cells = cellsFor(objective, input, byKey)
    if (cells) rows.push({ objective, cells })
  }
  return rows
}
