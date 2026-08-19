import { useMemo } from 'react'
import { useMilestones, groupByObjective } from '../../../hooks/useMilestones'
import { useObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useTasks } from '../../../hooks/useTasks'
import {
  daysOfWeek,
  quarterBounds,
  quarterOf,
  year as yearOf,
} from '../../../lib/appDate'
import { useDashboardCtx } from '../dashboardContext'
import { useDashboardObjectives } from '../useDashboardObjectives'
import { ObjectivesBlock } from './ObjectivesBlock'

/**
 * Les cartes d'objectifs, **épinglées en tête de l'accueil**.
 *
 * Ce n'est pas un widget : on ne la déplace pas, on ne la rétrécit pas, on ne la
 * retire pas. C'est l'identité de l'écran — trois objectifs, un rythme — et la
 * ranger au même rang qu'un aide-mémoire reviendrait à dire qu'on peut s'en passer.
 *
 * La section porte le chargement, `ObjectivesBlock` garde le rendu : c'est lui qui
 * sait dessiner la grille pleine en desktop et la bande compacte en mobile.
 */
export function ObjectivesSection() {
  const { today, privacy, poppingObjectiveId } = useDashboardCtx()
  const year = yearOf(today)

  const { principals, principalIds, weekByObjective } = useDashboardObjectives(today)

  const progressQuery = useObjectiveProgress(principalIds)
  const milestonesQuery = useMilestones(principalIds, year, quarterOf(today))
  const quarterRange = quarterBounds(today)
  const activeDaysQuery = useObjectiveActiveDays(
    principalIds,
    quarterRange.from,
    quarterRange.to,
  )
  const todayTasksQuery = useTasks('today', { today })

  const weekDays = useMemo(() => daysOfWeek(today), [today])
  const activeDays = useMemo(
    () => activeDaysQuery.data ?? new Set<string>(),
    [activeDaysQuery.data],
  )
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )

  // `activeDays` est la vérité serveur ; le cache des tâches couvre la latence
  // d'invalidation pour que le rallumage soit immédiat au clic.
  const activeToday = useMemo(() => {
    const ids = new Set<string>()
    for (const task of todayTasksQuery.data ?? []) {
      if (task.objective_id && task.completed_at !== null) ids.add(task.objective_id)
    }
    for (const objective of principals) {
      if (activeDays.has(`${objective.id}|${today}`)) ids.add(objective.id)
    }
    return ids
  }, [todayTasksQuery.data, activeDays, today, principals])

  return (
    <ObjectivesBlock
      objectives={principals}
      weekByObjective={weekByObjective}
      progressByObjective={progressQuery.data ?? new Map()}
      milestonesByObjective={milestonesByObjective}
      activeDays={activeDays}
      activeToday={activeToday}
      weekDays={weekDays}
      today={today}
      privacy={privacy}
      poppingObjectiveId={poppingObjectiveId}
    />
  )
}
