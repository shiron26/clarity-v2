// Les séances réparées depuis le rituel (REFONTE §7, écran 2).
//
// À ne pas confondre avec `useObjectiveActiveDays`, qui rend TOUS les jours
// crédités — l'union des jours de tâches et des jours de séances. Ici on ne lit
// que les séances, et c'est ce qui rend le geste réversible : une case allumée
// par une vraie tâche cochée ne se dé-coche pas depuis le rituel, seule une
// séance se retire. L'écran croise les deux lectures pour trancher.
//
// `objective_session` est une vraie table en clair, comme `objective_entry` :
// elle se lit et s'écrit directement, `viewWrites` ne la concerne pas.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { invalidateProgress, queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { IsoDate } from '../lib/appDate'
import { sessionKey } from '../lib/objectiveState'

export type ObjectiveSession = {
  id: string
  objective_id: string
  day: IsoDate
}

/**
 * Les séances de plusieurs objectifs sur une plage. Le rituel n'en demande
 * jamais plus d'une semaine à la fois.
 */
export function useObjectiveSessions(
  objectiveIds: string[],
  from: IsoDate | undefined,
  to: IsoDate | undefined,
) {
  const { status } = useAuth()
  const enabled = status === 'signedIn' && objectiveIds.length > 0 && !!from && !!to

  return useQuery({
    queryKey: queryKeys.objectiveSession.range(objectiveIds, from ?? '', to ?? ''),
    enabled,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('objective_session')
        .select('id, objective_id, day')
        .in('objective_id', objectiveIds)
        .gte('day', from!)
        .lte('day', to!)
      if (error) throw error
      // `objectifId|jour` → id de la ligne : l'écran teste l'appartenance pour
      // colorer, et a besoin de l'id pour retirer. Une Map rend les deux.
      const map = new Map<string, string>()
      for (const row of data as ObjectiveSession[]) {
        map.set(sessionKey(row.objective_id, row.day), row.id)
      }
      return map
    },
  })
}

// Une séance déplace le relevé de sa période, donc la régularité et la grille de
// densité — le serveur recalcule des choses qu'un patch local ne peut pas deviner.
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveSession.all })
  invalidateProgress(queryClient)
}

/**
 * `day` est la SEULE date que le client choisisse dans tout le produit — créditer
 * un jour passé est précisément la raison d'être de l'écran. Le serveur la borne
 * (pas de futur, pas hors fenêtre, habitude uniquement, objectif ouvert) ; le
 * front, lui, désactive les cases correspondantes plutôt que d'attendre l'erreur.
 *
 * Pas de retry : l'unicité `(objective_id, day)` rend un doublon inoffensif, mais
 * une insertion reste une insertion.
 */
export function useAddObjectiveSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ objectiveId, day }: { objectiveId: string; day: IsoDate }) => {
      const { error } = await supabase
        .from('objective_session')
        .insert({ objective_id: objectiveId, day })
      if (error) throw error
    },
    onSettled: () => invalidateAll(queryClient),
  })
}

export function useRemoveObjectiveSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('objective_session').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => invalidateAll(queryClient),
  })
}
