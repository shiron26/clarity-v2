// Écritures sur les tâches. `useToggleTask` couvre déjà la coche ; ici le reste.
//
// Deux régimes, comme ailleurs dans le projet : optimiste pour ce qui se clique
// sur une ligne (drapeau, liste, date, renommage, réordonnancement), simple
// invalidation pour les actions ponctuelles (créer, supprimer, reporter).
//
// Ce que le serveur fait dans notre dos et qu'un patch local ne peut pas deviner :
// le trigger AFTER `on_task_change` recalcule `objective_week` dès qu'une tâche
// **cochée et liée** change d'échéance, d'objectif, ou disparaît — d'où les
// invalidations larges sur ces cas précis.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { classifyError } from '../lib/queryError'
import { insertView, updateView, deleteView } from '../lib/viewWrites'
import { toRecurrenceJson, type Recurrence } from '../lib/recurrence'
import type { IsoDate } from '../lib/appDate'
import type { Task } from './useTasks'

export type NewTask = {
  userId: string
  title: string
  description: string | null
  dueDate: IsoDate | null
  objectiveId: string | null
  listId: string | null
  isImportant: boolean
  recurrence: Recurrence | null
  /** Rang souhaité dans la liste manuelle. Le serveur défaut à 0. */
  position: number
}

/** Champs modifiables. Jamais `user_id`/`space_id` : `task_owner_immutable`. */
export type TaskEdits = Partial<{
  title: string
  description: string | null
  due_date: IsoDate | null
  objective_id: string | null
  list_id: string | null
  is_important: boolean
  recurrence: Recurrence | null
}>

/** Les écritures idempotentes se retentent après un PGRST301 transitoire. */
const retryAuthTransient = (failureCount: number, error: Error) =>
  classifyError(error) === 'authTransient' && failureCount < 3

/** Patch de toutes les vues de tâches en cache, avec de quoi revenir en arrière. */
function patchCachedTasks(
  queryClient: ReturnType<typeof useQueryClient>,
  apply: (tasks: Task[]) => Task[],
) {
  const previous = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.task.all })
  queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.task.all }, (tasks) =>
    tasks ? apply(tasks) : tasks,
  )
  return previous
}

function restore(
  queryClient: ReturnType<typeof useQueryClient>,
  previous: ReturnType<typeof patchCachedTasks> | undefined,
) {
  for (const [key, data] of previous ?? []) queryClient.setQueryData(key, data)
}

/** Une tâche cochée qui bouge d'objectif ou d'échéance déplace un relevé hebdo. */
function touchesWeeklyRecord(edits: TaskEdits) {
  return 'objective_id' in edits || 'due_date' in edits
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    // Pas de retry : l'insertion n'est pas idempotente, un doublon en sortirait.
    mutationFn: async (input: NewTask) => {
      const { error } = await insertView('task', {
        user_id: input.userId,
        // Une tâche perso ne devient jamais une tâche d'espace (owner immuable) :
        // le choix se fait ici, une fois.
        space_id: null,
        assignee_id: null,
        list_id: input.listId,
        objective_id: input.objectiveId,
        title: input.title,
        description: input.description,
        due_date: input.dueDate,
        is_important: input.isImportant,
        position: input.position,
        recurrence: toRecurrenceJson(input.recurrence),
      })
      if (error) throw error
    },
    // Une tâche naît non cochée : aucun relevé hebdomadaire ne bouge.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    mutationFn: async ({ id, edits }: { id: string; edits: TaskEdits }) => {
      const { recurrence, ...rest } = edits
      const { error } = await updateView('task', {
        ...rest,
        ...('recurrence' in edits ? { recurrence: toRecurrenceJson(recurrence ?? null) } : {}),
      }).eq('id', id)
      if (error) throw error
    },

    onMutate: async ({ id, edits }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task.all })
      const { recurrence, ...rest } = edits
      const previous = patchCachedTasks(queryClient, (tasks) =>
        tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...rest,
                ...('recurrence' in edits
                  ? { recurrence: toRecurrenceJson(recurrence ?? null) }
                  : {}),
              }
            : t,
        ),
      )
      return { previous }
    },

    onError: (_error, _variables, context) => restore(queryClient, context?.previous),

    onSettled: (_data, _error, { edits }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      if (touchesWeeklyRecord(edits)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
        void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveActiveDays.all })
      }
    },
  })
}

/**
 * Suppression définitive (SPEC §3 : pas de corbeille). Sur une tâche récurrente,
 * elle arrête la chaîne : il n'y a pas d'objet « série » à côté.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    mutationFn: async (id: string) => {
      const { error } = await deleteView('task').eq('id', id)
      if (error) throw error
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task.all })
      const previous = patchCachedTasks(queryClient, (tasks) => tasks.filter((t) => t.id !== id))
      return { previous }
    },

    onError: (_error, _id, context) => restore(queryClient, context?.previous),

    // Supprimer une tâche cochée et liée refait le relevé de sa semaine.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveActiveDays.all })
    },
  })
}

/**
 * Réordonnancement manuel : on n'écrit que les lignes dont le rang change.
 * `position` est global au propriétaire, pas propre à la vue affichée — deux
 * tâches peuvent donc se retrouver ex æquo ; `useTasks` départage sur
 * `created_at`, l'ordre reste stable.
 */
export function useReorderTasks() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    // `positions` vient de l'appelant, pas du cache : `onMutate` tourne AVANT
    // `mutationFn` et l'a déjà réécrit — le diff y serait toujours vide.
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

      // Une vue à trigger INSTEAD OF n'accepte pas d'upsert : un UPDATE par ligne.
      const results = await Promise.all(
        writes.map((row) => updateView('task', { position: row.position }).eq('id', row.id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },

    onMutate: async ({ orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task.all })
      const rank = new Map(orderedIds.map((id, index) => [id, index]))
      const previous = patchCachedTasks(queryClient, (tasks) =>
        tasks.map((t) => (rank.has(t.id) ? { ...t, position: rank.get(t.id)! } : t)),
      )
      return { previous }
    },

    onError: (_error, _variables, context) => restore(queryClient, context?.previous),

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
    },
  })
}

/**
 * Report en masse (SPEC §5, la seule action groupée du produit). Le RPC ne touche
 * que les tâches **personnelles** en retard : une tâche partagée ne se déplace
 * jamais sans que les autres membres le sachent.
 */
export function usePostponeOverdue() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: retryAuthTransient,

    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('postpone_overdue_tasks')
      if (error) throw error
      return data ?? 0
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveActiveDays.all })
    },
  })
}
