import { useState } from 'react'
import { MilestoneList } from './MilestoneList'
import { HabitRhythm } from './HabitRhythm'
import { QuantityRhythm } from './QuantityRhythm'
import { ObjectiveEntryModal } from './ObjectiveEntryModal'
import { ObjectiveHeader } from './ObjectiveHeader'
import { ObjectiveHero } from './ObjectiveHero'
import { ObjectiveTasksBand } from './ObjectiveTasksBand'
import { detailLayout } from '../detailLayout'
import { heroContent } from '../heroContent'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { projectCompletion } from '../../../lib/objectiveProjection'
import { buildSeries } from '../../../lib/objectiveSeries'
import { totalDone } from '../../../lib/objectivePeriod'
import type { IsoDate } from '../../../lib/appDate'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveEntry } from '../../../hooks/useObjectiveEntries'
import type { ObjectivePeriod, PeriodUnit } from '../../../hooks/useObjectivePeriods'
import type { ObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import type { ObjectiveRegularity } from '../../../hooks/useObjectiveRegularity'

type ObjectiveDetailProps = {
  objective: Objective
  /** Relevés de CET objectif, dans SON unité de période. */
  periods: ObjectivePeriod[]
  regularity: ObjectiveRegularity | undefined
  progress: ObjectiveProgress | undefined
  /** Saisies de l'objectif — la projection d'une quantité en dépend. */
  entries: ObjectiveEntry[]
  /** L'échec de leur chargement, relayé tel quel à la bande de rythme. */
  entriesError: Error | null
  milestones: Milestone[]
  activeDays: Set<string>
  /** Lundis de la grille, déjà tronqués à la date d'arrêt. */
  weeks: IsoDate[]
  /** Trimestre affiché — dérivé de la fenêtre de l'objectif, jamais choisi. */
  quarter: number
  today: IsoDate
  /** Ouverture du bilan du trimestre, telle que le serveur la donne. */
  reviewOpenAt: string | undefined
  privacy?: boolean
  readOnly?: boolean
  onEdit: () => void
  onDeleted: () => void
}

/**
 * L'écran d'un objectif : **une bande, une question**.
 *
 * De quoi s'agit-il (en-tête) · où j'en suis (le héros) · est-ce que je tiens le
 * rythme (le bloc sombre) · la matière (étapes, tâches).
 *
 * Ce composant ne calcule rien et ne teste aucune mesure : `detailLayout` dit
 * quelles bandes existent, `heroContent` dit ce qu'elles écrivent. Les cinq
 * états de la maquette sont cinq combinaisons de ces deux réponses — d'où cinq
 * gardes à plat plutôt qu'une cascade.
 */
export function ObjectiveDetail({
  objective,
  periods,
  regularity,
  progress,
  entries,
  entriesError,
  milestones,
  activeDays,
  weeks,
  quarter,
  today,
  reviewOpenAt,
  privacy = false,
  readOnly = false,
  onEdit,
  onDeleted,
}: ObjectiveDetailProps) {
  const [entryOpen, setEntryOpen] = useState(false)

  const layout = detailLayout(objective)
  const skin = objectiveSkinOf(objective)
  const unit: PeriodUnit = objective.period_unit ?? 'week'

  const done = totalDone(periods, unit)
  const series = buildSeries(entries, objective.entry_mode)
  const projection = projectCompletion({
    objective,
    today,
    periods,
    totalDone: done,
    series,
    quantityValue: progress?.value ?? 0,
  })

  const hero = heroContent({
    objective,
    layout,
    quarter,
    today,
    totalDone: done,
    quantityValue: progress?.value ?? 0,
    milestones,
    projection,
    reviewOpenAt,
  })

  return (
    <article className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <ObjectiveHeader
        objective={objective}
        meta={hero.meta}
        dim={layout.dim}
        privacy={privacy}
        readOnly={readOnly}
        onEdit={onEdit}
        onDeleted={onDeleted}
      />

      <ObjectiveHero
        value={hero.value}
        of={hero.of}
        suffix={hero.suffix}
        percent={hero.percent}
        color={layout.dim ? 'var(--color-border-strong)' : skin.core}
        projection={hero.projection}
        action={
          layout.entryAction && !readOnly
            ? { label: 'Saisir mon relevé', onClick: () => setEntryOpen(true) }
            : undefined
        }
      />

      {layout.rhythm === 'heatmap' && (
        <HabitRhythm
          objective={objective}
          periods={periods}
          regularity={regularity}
          activeDays={activeDays}
          weeks={weeks}
          quarter={quarter}
          today={today}
          showRegularity={layout.regularity}
          privacy={privacy}
        />
      )}

      {layout.rhythm === 'curve' && (
        <QuantityRhythm
          objective={objective}
          regularity={regularity}
          showRegularity={layout.regularity}
          series={series}
          entriesError={entriesError}
        />
      )}

      {/* Une bande d'étapes vide et non modifiable n'apprend rien : sur un
          objectif arrêté, « 0 / 0 » se lit comme un manque là où il n'y a
          simplement rien eu. */}
      {layout.milestones && !(layout.dim && milestones.length === 0) && (
        <MilestoneList
          objective={objective}
          milestones={milestones}
          quarter={quarter}
          title={hero.milestonesTitle}
          privacy={privacy}
          readOnly={readOnly || layout.dim}
        />
      )}

      {layout.relatedTasks && (
        <ObjectiveTasksBand objective={objective} today={today} readOnly={readOnly || layout.dim} />
      )}

      {layout.entryAction && (
        <ObjectiveEntryModal
          open={entryOpen}
          onClose={() => setEntryOpen(false)}
          objective={objective}
          progress={progress}
        />
      )}
    </article>
  )
}
