// Une ligne par objectif : son rythme et son chiffre, réunis.
//
// Ce module ne calcule rien de neuf — il compose `buildQuarterRows` (les cases)
// et `buildQuarterStats` (le chiffre et sa sous-ligne), et décide qui mérite une
// ligne. C'est ce qui permet à l'écran de n'écrire le titre qu'une fois.
import { buildQuarterRows, type QuarterCell, type QuarterTimelineInput } from '../../lib/quarterTimeline'
import { buildQuarterStats } from '../../lib/quarterStats'
import type { ObjectiveSkin } from '../../lib/objectivePalette'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveEntry } from '../../hooks/useObjectiveEntries'
import type { Milestone } from '../../hooks/useMilestones'

export type QuarterLine = {
  objective: Objective
  skin: ObjectiveSkin
  secondary: boolean
  /** Les cases du trimestre. **Vide** pour un objectif jalonné : des étapes n'ont
   *  pas de rythme, et l'absence de frise le dit mieux qu'une piste plate. */
  cells: QuarterCell[]
  value: string
  detail: string
}

export function buildQuarterLines(
  input: QuarterTimelineInput & {
    entries: ObjectiveEntry[]
    milestones: Milestone[]
  },
): QuarterLine[] {
  const rows = buildQuarterRows(input)
  const cellsByObjective = new Map(rows.map((row) => [row.objective.id, row.cells]))

  // Un objectif jalonné n'a aucun relevé, donc aucune piste — il a pourtant un
  // chiffre à montrer (« 2 étapes sur 4 »), dès lors qu'il porte des étapes sur
  // ce trimestre-là.
  const subjects = input.objectives.filter(
    (o) =>
      cellsByObjective.has(o.id) ||
      (o.measure === 'jalons' && input.milestones.some((m) => m.objective_id === o.id)),
  )

  return buildQuarterStats({
    objectives: subjects,
    periods: input.periods,
    entries: input.entries,
    milestones: input.milestones,
    weeks: input.weeks,
    year: input.year,
    quarter: input.quarter,
    today: input.today,
  }).map((stat) => ({
    objective: stat.objective,
    skin: stat.skin,
    secondary: stat.secondary,
    cells: cellsByObjective.get(stat.objective.id) ?? [],
    value: stat.value,
    detail: stat.detail,
  }))
}
