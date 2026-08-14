// Écritures sur les objectifs. Basse fréquence : pas d'optimistic update, une
// simple invalidation en onSettled suffit (modèle useCompleteOnboarding).
//
// Les colonnes d'identité (`user_id`, `year`, `kind`, `slot`) sont immuables
// après création : l'édition ne les envoie jamais, sinon le trigger lève
// `objective_identity_immutable`.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { deleteView, insertView, updateView } from '../lib/viewWrites'

export type ObjectiveKind = 'principal' | 'secondaire'

export type NewObjective = {
  userId: string
  year: number
  kind: ObjectiveKind
  label: string
  title: string
  why: string | null
  description: string | null
  /** Obligatoire (1–7) sur un principal, doit rester null sur un secondaire. */
  cadence: number | null
}

export type ObjectiveEdits = {
  label: string
  title: string
  why: string | null
  description: string | null
  cadence: number | null
}

/**
 * `slot` n'est volontairement pas envoyé : le serveur attribue le plus petit
 * emplacement libre sous verrou, et lève `slot_full` s'il n'en reste aucun.
 */
export function useCreateObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewObjective) => {
      const { error } = await insertView('objective', {
        user_id: input.userId,
        space_id: null,
        parent_objective_id: null,
        year: input.year,
        kind: input.kind,
        label: input.label,
        title: input.title,
        why: input.why,
        description: input.description,
        cadence: input.cadence,
      })
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
    },
  })
}

export function useUpdateObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, edits }: { id: string; edits: ObjectiveEdits }) => {
      const { error } = await updateView('objective', {
        label: edits.label,
        title: edits.title,
        why: edits.why,
        description: edits.description,
        cadence: edits.cadence,
      }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
    },
  })
}

// PostgREST exige un timestamptz valide ; le trigger l'écrase par `now()`.
// Une constante figée plutôt que `new Date()` : l'instant de clôture est une
// donnée serveur, l'horloge du navigateur n'a pas voix au chapitre.
const CLOSURE_SIGNAL = '1970-01-01T00:00:00.000Z'

/**
 * Clôturer = « atteint », déclaré par l'utilisateur et réversible (SPEC §3).
 * Aucune ligne `objective_week` n'est produite pendant la clôture, d'où
 * l'invalidation du relevé hebdomadaire en plus de l'objectif.
 */
export function useCloseObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, closed }: { id: string; closed: boolean }) => {
      const { error } = await updateView('objective', {
        closed_at: closed ? CLOSURE_SIGNAL : null,
      }).eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
    },
  })
}

/**
 * Supprimer libère le slot sans décaler les autres. Les jalons partent en
 * cascade ; les tâches survivent, simplement détachées (`on delete set null`) —
 * d'où l'invalidation des tâches.
 */
export function useDeleteObjective() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteView('objective').eq('id', id)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.objective.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.milestone.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
    },
  })
}
