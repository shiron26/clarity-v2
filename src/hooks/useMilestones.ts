// Jalons du trimestre. Tempo indépendant de la cadence hebdomadaire : cocher un
// jalon ne produit aucun signal ailleurs (SPEC §3) — ils sont ici pour informer,
// jamais pour alimenter un compteur.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type Milestone = {
  id: string
  objective_id: string
  year: number
  quarter: number
  position: number
  title: string
  completed_at: string | null
}

export function useMilestones(
  objectiveIds: string[],
  year: number | undefined,
  quarter: number | undefined,
) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0 && !!year && !!quarter

  return useQuery({
    queryKey: queryKeys.milestone.byObjectives(objectiveIds, year ?? 0, quarter ?? 0),
    enabled,
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase
        .from('milestone')
        .select('id, objective_id, year, quarter, position, title, completed_at')
        .in('objective_id', objectiveIds)
        .eq('year', year!)
        .eq('quarter', quarter!)
        .order('position', { ascending: true })
      if (error) throw error
      return data as Milestone[]
    },
  })
}

/** Regroupe les jalons par objectif, en conservant l'ordre de `position`. */
export function groupByObjective(milestones: Milestone[] | undefined) {
  const map = new Map<string, Milestone[]>()
  for (const m of milestones ?? []) {
    const bucket = map.get(m.objective_id)
    if (bucket) bucket.push(m)
    else map.set(m.objective_id, [m])
  }
  return map
}
