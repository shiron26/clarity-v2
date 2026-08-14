// Jours crédités, reconstruits côté serveur (public.objective_active_days, 0012).
// La règle `credit_day` reste ainsi à un seul endroit : la réécrire en
// TypeScript la ferait dériver dès qu'elle bougerait en base.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { IsoDate } from '../lib/appDate'

export function useObjectiveActiveDays(
  objectiveIds: string[],
  from: IsoDate | undefined,
  to: IsoDate | undefined,
) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0 && !!from && !!to

  return useQuery({
    queryKey: queryKeys.objectiveActiveDays.range(objectiveIds, from ?? '', to ?? ''),
    enabled,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.rpc('objective_active_days', {
        p_objectives: objectiveIds,
        p_from: from!,
        p_to: to!,
      })
      if (error) throw error
      // Clé `objectif|jour` : la heatmap n'a besoin que d'un test d'appartenance.
      return new Set(data.map((row) => `${row.objective_id}|${row.day}`))
    },
  })
}
