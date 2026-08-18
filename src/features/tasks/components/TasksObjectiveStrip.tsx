import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import { isObjectiveLit } from '../../../lib/objectiveState'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectivePeriod } from '../../../hooks/useObjectivePeriods'
import type { ObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import type { IsoDate } from '../../../lib/appDate'

type TasksObjectiveStripProps = {
  objectives: Objective[]
  /** Relevé de la semaine en cours, par objectif. */
  weekByObjective: Map<string, ObjectivePeriod>
  progressByObjective: Map<string, ObjectiveProgress>
  milestonesByObjective: Map<string, Milestone[]>
  activeDays: Set<string>
  /** Objectifs ayant déjà avancé aujourd'hui — décidé par la page, seule à
   *  connaître les tâches cochées du cache. */
  activeToday: Set<string>
  weekDays: IsoDate[]
  today: IsoDate
  /** Mode masqué de la coquille — la bande porte des titres d'objectifs. */
  privacy: boolean
  poppingObjectiveId: string | null
}

/**
 * La bande d'objectifs en tête de l'écran Tâches — **compacte et desktop
 * seulement** (REFONTE §5) : sur 390 px elle mangerait l'écran avant la
 * première tâche. Elle rappelle à quoi les tâches se relient sans jamais
 * concurrencer la liste.
 *
 * Elle passe les jalons et la progression comme le dashboard : sans eux, un
 * objectif jalonné afficherait « 0 / 0 » et un quantifié un montant nul — la
 * carte dirait faux.
 */
export function TasksObjectiveStrip({
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
}: TasksObjectiveStripProps) {
  if (objectives.length === 0) return null

  return (
    <section className="hidden lg:block">
      <h2 className="mb-2 text-[10px] font-semibold tracking-[1.3px] text-ink-muted">
        VOS OBJECTIFS
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        {objectives.map((objective) => {
          const week = weekByObjective.get(objective.id)
          return (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              week={week}
              activeDays={activeDays}
              milestones={milestonesByObjective.get(objective.id) ?? []}
              progress={progressByObjective.get(objective.id)}
              daysOfWeek={weekDays}
              today={today}
              privacy={privacy}
              compact
              lit={isObjectiveLit({
                objective,
                week,
                activeToday: activeToday.has(objective.id),
              })}
              popping={poppingObjectiveId === objective.id}
            />
          )
        })}
      </div>
    </section>
  )
}
