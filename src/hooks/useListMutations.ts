// Écritures sur les listes. Basse fréquence (une modale dédiée) : pas d'optimistic
// update, sauf pour le réordonnancement, qui se fait à la souris.
//
// Le gestionnaire ne manipule que les listes **personnelles** : la création, le
// renommage et la suppression d'une liste d'espace appartiennent au contexte
// espace (SPEC §3).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { retryAuthTransient } from '../lib/queryError'
import { deleteView, insertView, updateView } from '../lib/viewWrites'
import type { List } from './useLists'

export function useCreateList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { userId: string; name: string; color: string; position: number }) => {
      const { error } = await insertView('list', {
        user_id: input.userId,
        space_id: null,
        name: input.name,
        color: input.color,
        position: input.position,
      })
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.list.all })
    },
  })
}

export function useUpdateList() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async ({
      id,
      edits,
    }: {
      id: string
      edits: Partial<{ name: string; color: string }>
    }) => {
      const { error } = await updateView('list', edits).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.list.all })
    },
  })
}

/**
 * Supprimer une liste **détache** ses tâches (`on delete set null`), il ne les
 * supprime pas — d'où l'invalidation des tâches : leur `list_id` a changé côté
 * serveur sans que rien d'autre ne le signale.
 */
export function useDeleteList() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async (id: string) => {
      const { error } = await deleteView('list').eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.list.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
    },
  })
}

export function useReorderLists() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    // `positions` vient de l'appelant : `onMutate` a déjà réécrit le cache quand
    // `mutationFn` s'exécute, le diff y serait toujours vide.
    mutationFn: async ({
      orderedIds,
      positions,
    }: {
      orderedIds: string[]
      positions: Map<string, number>
    }) => {
      const writes = orderedIds
        .map((id, index) => ({ id, position: index }))
        .filter((row) => positions.get(row.id) !== row.position)

      const results = await Promise.all(
        writes.map((row) => updateView('list', { position: row.position }).eq('id', row.id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },

    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.list.all })
      const previous = queryClient.getQueryData<List[]>(queryKeys.list.all)
      const rank = new Map(orderedIds.map((id, index) => [id, index]))
      queryClient.setQueryData<List[]>(queryKeys.list.all, (lists) =>
        lists
          ? [...lists]
              .map((l) => (rank.has(l.id) ? { ...l, position: rank.get(l.id)! } : l))
              .sort((a, b) => a.position - b.position)
          : lists,
      )
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.list.all, context.previous)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.list.all })
    },
  })
}
