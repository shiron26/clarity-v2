// Progression d'un objectif quantifié (public.objective_progress, REFONTE §1.2).
//
// `value` est la somme des saisies en mode `cumul`, la DERNIÈRE saisie en mode
// `releve`. Un relevé peut baisser (un solde bancaire baisse) : ni la RPC ni ce
// hook ne bornent quoi que ce soit.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { IsoDate } from '../lib/appDate'

export type ObjectiveProgress = {
  objective_id: string
  value: number
  entries: number
  last_entry_date: IsoDate | null
}

export function useObjectiveProgress(objectiveIds: string[]) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0

  return useQuery({
    queryKey: queryKeys.objectiveProgress.byObjectives(objectiveIds),
    enabled,
    queryFn: async (): Promise<Map<string, ObjectiveProgress>> => {
      const { data, error } = await supabase.rpc('objective_progress', {
        p_objectives: objectiveIds,
      })
      if (error) throw error
      const map = new Map<string, ObjectiveProgress>()
      for (const row of data) map.set(row.objective_id, row as ObjectiveProgress)
      return map
    },
  })
}
