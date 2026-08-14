// Relevé hebdomadaire : LA source de vérité de la progression (SPEC §4.1).
// `cadence_target` y est figée semaine par semaine — le client ne recalcule
// jamais ces valeurs à partir de ses tâches, il les lit.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type ObjectiveWeek = {
  objective_id: string
  iso_year: number
  iso_week: number
  cadence_target: number
  active_days: number
}

export function useObjectiveWeeks(objectiveIds: string[], isoYear: number | undefined) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0 && !!isoYear

  return useQuery({
    queryKey: queryKeys.objectiveWeek.byObjectives(objectiveIds, isoYear ?? 0),
    enabled,
    queryFn: async (): Promise<ObjectiveWeek[]> => {
      const { data, error } = await supabase
        .from('objective_week')
        .select('objective_id, iso_year, iso_week, cadence_target, active_days')
        .in('objective_id', objectiveIds)
        .eq('iso_year', isoYear!)
      if (error) throw error
      return data as ObjectiveWeek[]
    },
  })
}

/** Index `objectif|semaine` → relevé, pour un accès direct depuis les cartes. */
export function indexWeeks(weeks: ObjectiveWeek[] | undefined) {
  const map = new Map<string, ObjectiveWeek>()
  for (const w of weeks ?? []) map.set(`${w.objective_id}|${w.iso_week}`, w)
  return map
}
