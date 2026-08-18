// Les saisies d'un objectif quantifié, quand l'écran a besoin du détail et pas
// seulement du total rendu par `useObjectiveProgress` — la courbe de la page
// Objectifs affiche ses points de relevé, et un écart entre deux points est une
// période sans saisie.
//
// `objective_entry` est une vraie table en clair, pas une vue déchiffrante :
// elle se lit et s'écrit directement, comme `public.review`. `viewWrites` ne la
// concerne pas — ce helper n'existe que parce qu'une vue n'a pas de type Insert.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { IsoDate } from '../lib/appDate'

export type ObjectiveEntry = {
  id: string
  objective_id: string
  entry_date: IsoDate
  value: number
}

export function useObjectiveEntries(objectiveId: string | undefined) {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.objectiveEntry.byObjective(objectiveId ?? ''),
    enabled: status === 'signedIn' && !!objectiveId,
    queryFn: async (): Promise<ObjectiveEntry[]> => {
      const { data, error } = await supabase
        .from('objective_entry')
        .select('id, objective_id, entry_date, value')
        .eq('objective_id', objectiveId!)
        .order('entry_date', { ascending: true })
      if (error) throw error
      return data as ObjectiveEntry[]
    },
  })
}

/**
 * Les saisies de PLUSIEURS objectifs sur une plage — l'écran Année lit une année
 * entière d'un coup pour en tirer l'apport de chaque trimestre.
 *
 * `objective_progress` ne convient pas ici : il rend un total global, or un
 * trimestre demande un montant borné. Et une somme par trimestre ne se déduit
 * pas d'un total.
 */
export function useObjectiveEntriesRange(
  objectiveIds: string[],
  from: IsoDate | undefined,
  to: IsoDate | undefined,
) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0 && !!from && !!to

  return useQuery({
    queryKey: queryKeys.objectiveEntry.range(objectiveIds, from ?? '', to ?? ''),
    enabled,
    queryFn: async (): Promise<ObjectiveEntry[]> => {
      const { data, error } = await supabase
        .from('objective_entry')
        .select('id, objective_id, entry_date, value')
        .in('objective_id', objectiveIds)
        .gte('entry_date', from!)
        .lte('entry_date', to!)
        .order('entry_date', { ascending: true })
      if (error) throw error
      return data as ObjectiveEntry[]
    },
  })
}

/**
 * `entry_date` n'est volontairement pas envoyée : le serveur la pose au jour
 * applicatif, même doctrine que `completed_at` et `closed_at`. Saisir un relevé
 * antidaté n'est pas un besoin du produit.
 *
 * Une saisie déplace la période en cours, donc le relevé et la régularité
 * projetée : les trois s'invalident ensemble.
 */
export function useAddObjectiveEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ objectiveId, value }: { objectiveId: string; value: number }) => {
      const { error } = await supabase
        .from('objective_entry')
        .insert({ objective_id: objectiveId, value })
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveEntry.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveProgress.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectivePeriod.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveRegularity.all })
    },
  })
}
