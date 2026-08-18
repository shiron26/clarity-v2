import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import { isObjectiveLit } from '../../../lib/objectiveState'
import { MAX_PRINCIPALS } from '../../../hooks/useObjectives'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectivePeriod } from '../../../hooks/useObjectivePeriods'
import type { ObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import type { IsoDate } from '../../../lib/appDate'
import { ObjectiveSlotInvite } from './ObjectiveSlotInvite'
import { ObjectiveSlotsEmpty } from './ObjectiveSlotsEmpty'
import { cn } from '../../../lib/cn'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'

/**
 * « Vos objectifs » : la tête de page du dashboard.
 *
 * Cartes **pleines en desktop** (une colonne par emplacement) et **compactes en
 * mobile** (une par ligne) : à trois par ligne sur 390 px, le titre tombait à
 * « M… ». Les deux variantes rendent le même composant, la bascule est
 * purement CSS.
 */
type ObjectivesBlockProps = {
  objectives: Objective[]
  /** Relevé de la semaine en cours, par objectif. */
  weekByObjective: Map<string, ObjectivePeriod>
  progressByObjective: Map<string, ObjectiveProgress>
  milestonesByObjective: Map<string, Milestone[]>
  activeDays: Set<string>
  /** Objectifs ayant déjà avancé aujourd'hui (cache des tâches inclus). */
  activeToday: Set<string>
  weekDays: IsoDate[]
  today: IsoDate
  privacy: boolean
  poppingObjectiveId: string | null
}

export function ObjectivesBlock({
  objectives,
  weekByObjective,
  progressByObjective,
  milestonesByObjective,
  activeDays,
  activeToday,
  weekDays,
  today,
  privacy,
  poppingObjectiveId,
}: ObjectivesBlockProps) {
  const freeSlots = MAX_PRINCIPALS - objectives.length

  function cardFor(objective: Objective, compact: boolean) {
    const week = weekByObjective.get(objective.id)
    return (
      <ObjectiveCard
        key={objective.id}
        objective={objective}
        week={week}
        activeDays={activeDays}
        milestones={milestonesByObjective.get(objective.id) ?? []}
        daysOfWeek={weekDays}
        today={today}
        progress={progressByObjective.get(objective.id)}
        compact={compact}
        privacy={privacy}
        lit={isObjectiveLit({
          objective,
          week,
          activeToday: activeToday.has(objective.id),
        })}
        popping={poppingObjectiveId === objective.id}
      />
    )
  }

  return (
    <section>
      <h2 className={cn(SECTION_LABEL, 'mb-3')}>
        {objectives.length === 1 ? 'VOTRE OBJECTIF' : 'VOS OBJECTIFS'}
      </h2>

      {objectives.length === 0 ? (
        <ObjectiveSlotsEmpty />
      ) : (
        <>
          {/* desktop : une colonne par emplacement */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-3">
            {objectives.map((objective) => cardFor(objective, false))}
            {freeSlots > 0 && <ObjectiveSlotInvite freeSlots={freeSlots} />}
          </div>

          {/* mobile : les cartes compactes s'empilent, une par ligne */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {objectives.map((objective) => cardFor(objective, true))}
            {freeSlots > 0 && <ObjectiveSlotInvite freeSlots={freeSlots} />}
          </div>
        </>
      )}
    </section>
  )
}
