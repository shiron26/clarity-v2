// Cocher / décocher une tâche. Interaction à haute fréquence → optimistic
// update, avec rollback en onError.
//
// La complétion déclenche côté serveur deux effets qu'un patch local ne peut pas
// deviner : le rafraîchissement du relevé hebdomadaire (objective_week) et, si la
// tâche est récurrente, la création de l'occurrence suivante. D'où l'invalidation
// large en onSettled, en plus du patch optimiste.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { classifyError } from '../lib/queryError'
import { updateView } from '../lib/viewWrites'
import type { Task } from './useTasks'

// PostgREST exige un timestamptz valide ; le trigger l'écrase par `now()`.
// Une constante figée plutôt que `new Date()`, pour qu'aucune lecture du code
// ne laisse croire que l'horloge du navigateur compte.
const COMPLETION_SIGNAL = '1970-01-01T00:00:00.000Z'

export function useToggleTask() {
  const queryClient = useQueryClient()

  return useMutation({
    // L'écriture est idempotente (on pose une valeur, on n'incrémente rien) :
    // elle peut être retentée sans risque de doublon, contrairement au défaut
    // des mutations. Couvre le 401 PGRST301 transitoire des premières secondes
    // suivant une connexion — voir src/lib/queryError.ts.
    retry: (failureCount, error) => classifyError(error) === 'authTransient' && failureCount < 3,

    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      // completed_by est imposé par le trigger — ViewPatch ne le propose même pas.
      // completed_at l'est aussi depuis 0013 : la valeur envoyée ici n'est lue
      // que comme un signal booléen (null / non-null), le serveur pose
      // l'estampille avec sa propre horloge. Ne pas la croire au retour.
      const { error } = await updateView('task', {
        completed_at: completed ? COMPLETION_SIGNAL : null,
      }).eq('id', id)
      if (error) throw error
    },

    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.task.all })
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.task.all })

      // Patch purement local, remplacé par la valeur serveur à l'invalidation :
      // l'UI ne teste que la nullité de `completed_at`, jamais sa valeur.
      queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.task.all }, (tasks) =>
        tasks?.map((t) =>
          t.id === id ? { ...t, completed_at: completed ? new Date().toISOString() : null } : t,
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.task.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveWeek.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveActiveDays.all })
    },
  })
}
