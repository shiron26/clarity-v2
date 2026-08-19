// Ce que les widgets d'objectifs partagent : les principaux de la fenêtre en
// cours et leur relevé de la semaine.
//
// Deux widgets en ont besoin — les cartes, et l'état vide d'« Aujourd'hui » qui
// dit « vos trois séances sont faites ». Les queries se dédoublonnent d'
// elles-mêmes (mêmes clés), le hook ne coûte donc rien de plus qu'un calcul.
import { useMemo } from 'react'
import { selectPrincipals, useObjectives } from './../../hooks/useObjectives'
import {
  indexPeriods,
  periodKey,
  useObjectivePeriods,
  type ObjectivePeriod,
} from './../../hooks/useObjectivePeriods'
import { isWithinWindow } from '../../lib/objectiveFeasibility'
import { isoWeek, year as yearOf, type IsoDate } from '../../lib/appDate'

export function useDashboardObjectives(today: IsoDate) {
  const year = yearOf(today)
  const week = isoWeek(today)

  const objectivesQuery = useObjectives(year)
  // La query charge l'ANNÉE entière ; l'accueil ne parle que d'aujourd'hui. Sans
  // le filtre de fenêtre, un objectif pris pour le trimestre prochain s'afficherait
  // à « 0 séance cette semaine », un reproche pour une fenêtre qui n'a pas commencé.
  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data).filter((o) => isWithinWindow(o, today)),
    [objectivesQuery.data, today],
  )
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])
  const periodsQuery = useObjectivePeriods(principalIds, 'week', week.isoYear)

  const weekByObjective = useMemo(() => {
    const byObjective = new Map<string, ObjectivePeriod>()
    const periods = indexPeriods(periodsQuery.data)
    for (const id of principalIds) {
      const period = periods.get(periodKey(id, 'week', week.isoYear, week.isoWeek))
      if (period) byObjective.set(id, period)
    }
    return byObjective
  }, [periodsQuery.data, principalIds, week.isoYear, week.isoWeek])

  // « Vos N séances de la semaine sont faites » ne s'écrit que si c'est vrai :
  // toutes les habitudes ont atteint leur cadence.
  const habits = principals.filter((o) => o.measure === 'habitude')
  const weekComplete =
    habits.length > 0 &&
    habits.every((o) => {
      const period = weekByObjective.get(o.id)
      return !!period && period.done >= period.target
    })
  const sessionsThisWeek = habits.reduce(
    (sum, o) => sum + (weekByObjective.get(o.id)?.done ?? 0),
    0,
  )

  return {
    objectivesQuery,
    periodsQuery,
    principals,
    principalIds,
    weekByObjective,
    weekComplete,
    sessionsThisWeek,
  }
}
