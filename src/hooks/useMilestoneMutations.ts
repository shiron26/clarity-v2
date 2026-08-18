// Écritures sur les jalons.
//
// `objective_id`, `year` et `quarter` sont immuables après création : aucun
// déplacement entre trimestres n'est possible (SPEC §3 — « un jalon non coché
// reste dans son trimestre ; pour le poursuivre, on le réécrit ailleurs »).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { retryAuthTransient } from '../lib/queryError'
import { TIMESTAMP_SIGNAL, deleteView, insertView, updateView } from '../lib/viewWrites'
import type { Milestone } from './useMilestones'

export function useCreateMilestone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      objectiveId: string
      year: number
      quarter: number
      title: string
      position: number
    }) => {
      const { error } = await insertView('milestone', {
        objective_id: input.objectiveId,
        year: input.year,
        quarter: input.quarter,
        title: input.title,
        position: input.position,
      })
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
    },
  })
}

/**
 * Les jalons posés d'un coup, à la création d'un objectif jalonné (REFONTE §2).
 *
 * Une seule écriture plutôt que quatre : le cap serveur `milestone_cap` compte
 * les lignes déjà présentes, et quatre insertions successives laisseraient une
 * fenêtre où une erreur réseau abandonne un objectif à moitié jalonné.
 * `position` suit l'ordre de saisie.
 */
export function useCreateMilestones() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      objectiveId: string
      year: number
      quarter: number
      titles: string[]
    }) => {
      if (input.titles.length === 0) return
      const { error } = await insertView(
        'milestone',
        input.titles.map((title, position) => ({
          objective_id: input.objectiveId,
          year: input.year,
          quarter: input.quarter,
          title,
          position,
        })),
      )
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
    },
  })
}


/**
 * Cocher un jalon ne produit aucun signal ailleurs — ni jour actif, ni
 * compteur (SPEC §3, principe des deux tempos). L'invalidation reste donc
 * limitée aux jalons, contrairement au cochage d'une tâche.
 *
 * Interaction directe et fréquente → optimistic update avec rollback.
 */
export function useToggleMilestone() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await updateView('milestone', {
        completed_at: completed ? TIMESTAMP_SIGNAL : null,
      }).eq('id', id)
      if (error) throw error
    },

    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.milestone.all })
      const previous = queryClient.getQueriesData<Milestone[]>({
        queryKey: queryKeys.milestone.all,
      })

      // Patch purement local, remplacé par la valeur serveur à l'invalidation :
      // l'UI ne teste que la nullité de `completed_at`, jamais sa valeur.
      queryClient.setQueriesData<Milestone[]>({ queryKey: queryKeys.milestone.all }, (rows) =>
        rows?.map((m) =>
          m.id === id
            ? { ...m, completed_at: completed ? new Date().toISOString() : null }
            : m,
        ),
      )

      return { previous }
    },

    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
    },
  })
}

/** Suppression libre, coché ou non — le seul moyen de nettoyer un jalon réécrit. */
export function useDeleteMilestone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteView('milestone').eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
    },
  })
}
