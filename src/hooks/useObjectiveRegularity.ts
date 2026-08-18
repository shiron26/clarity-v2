// Régularité glissante (public.objective_regularity, REFONTE §1.3).
//
// « Tenu sur attendu » sur les 4 dernières périodes CLOSES, chaque période
// plafonnée à 100 % : une semaine à 5 séances sur 3 ne rachète pas une semaine
// à 0. Le calcul reste en base — le refaire ici en dupliquerait la règle, et
// c'est exactement ce que la RPC évite en rendant aussi les valeurs projetées.
//
// Un objectif jalonné n'a pas de ligne : les jalons n'ont pas de rythme.
// L'absence de valeur EST la règle produit, elle ne se remplace pas par un zéro.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type ObjectiveRegularity = {
  objective_id: string
  /** Fait sur les 4 dernières périodes closes, plafonné période par période. */
  done: number
  /** Attendu sur ces mêmes périodes. */
  target: number
  /** Les mêmes, fenêtre glissée d'un cran : les 3 dernières closes + la période en cours. */
  done_projected: number
  target_projected: number
}

export function useObjectiveRegularity(objectiveIds: string[]) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0

  return useQuery({
    queryKey: queryKeys.objectiveRegularity.byObjectives(objectiveIds),
    enabled,
    queryFn: async (): Promise<Map<string, ObjectiveRegularity>> => {
      const { data, error } = await supabase.rpc('objective_regularity', {
        p_objectives: objectiveIds,
      })
      if (error) throw error
      const map = new Map<string, ObjectiveRegularity>()
      for (const row of data) map.set(row.objective_id, row as ObjectiveRegularity)
      return map
    },
  })
}
