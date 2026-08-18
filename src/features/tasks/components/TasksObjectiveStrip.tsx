import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'
import { cn } from '../../../lib/cn'
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
 * La bande d'objectifs en tête de l'écran Tâches. Elle rappelle à quoi les
 * tâches se relient sans jamais concurrencer la liste : cartes **compactes aux
 * deux largeurs**, trois par ligne au-dessus de `lg`, empilées en dessous —
 * exactement le pliage du dashboard (`ObjectivesBlock`), au même endroit de la
 * page et dans le même ordre. Une seule variante de carte à connaître d'un
 * écran à l'autre.
 *
 * Elle était desktop seulement (REFONTE §5, amendé) : trois cartes serrées à
 * 390 px repoussent la première tâche d'environ 260 px. C'est le prix assumé
 * pour que l'écran le plus visité rappelle sur quoi il compte.
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
    <section>
      <h2 className={cn(SECTION_LABEL, 'mb-2')}>
        {objectives.length === 1 ? 'VOTRE OBJECTIF' : 'VOS OBJECTIFS'}
      </h2>
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3">
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
