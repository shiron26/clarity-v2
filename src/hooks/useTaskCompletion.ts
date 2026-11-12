// Cocher une tâche depuis une ligne : la mutation optimiste, la séquence
// d'animation, et le rattrapage en cas d'échec — d'un seul tenant.
//
// L'accueil, l'écran Tâches et « Ma journée » câblaient chacun ce trio à la main,
// avec le même contrat implicite : n'animer que la complétion (décocher ne se
// célèbre pas), et effacer l'animation si la mutation échoue, sans quoi la ligne
// rendue à « non cochée » par le rollback garderait un flash orphelin. Le
// contrat vit maintenant ici, une fois.
import { useCallback } from 'react'
import { useDoneSequence } from './useDoneSequence'
import { useUpdateTask } from './useTaskMutations'
import type { Task } from './useTasks'
import { useToggleTask } from './useToggleTask'

/**
 * `exit` est relayé à `useDoneSequence` : `false` garde la ligne cochée à sa
 * place (« Ma journée »), au lieu de la faire sortir de la liste.
 */
export function useTaskCompletion(options?: { exit?: boolean }) {
  const toggleTask = useToggleTask()
  const updateTask = useUpdateTask()
  const sequence = useDoneSequence(options)
  const { startDoneSequence, clearDone } = sequence
  // `mutate` est stable d'un rendu à l'autre (TanStack v5) ; l'objet de mutation,
  // lui, ne l'est pas — d'où ces deux extraits pour les dépendances.
  const toggle = toggleTask.mutate
  const update = updateTask.mutate

  const onToggle = useCallback(
    (task: Task) => {
      const completing = task.completed_at === null
      // Le rollback de `onMutate` remet la tâche à non cochée : elle doit
      // réapparaître sans animation résiduelle.
      toggle({ id: task.id, completed: completing }, { onError: () => clearDone(task.id) })
      // Décocher ne joue rien : seule la complétion se célèbre.
      if (completing) startDoneSequence(task)
    },
    [toggle, clearDone, startDoneSequence],
  )

  const onToggleImportant = useCallback(
    (task: Task) => update({ id: task.id, edits: { is_important: !task.is_important } }),
    [update],
  )

  return {
    ...sequence,
    onToggle,
    onToggleImportant,
    /** Exposées pour les écrans qui en lisent l'erreur ou y ajoutent d'autres éditions. */
    toggleTask,
    updateTask,
  }
}
