import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queryKeys'
import type { Task } from '../../hooks/useTasks'

/**
 * Rang d'une tâche qu'on veut voir naître **en fin** de l'ordre manuel.
 *
 * `position` est `not null default 0` côté base et le trigger `INSTEAD OF INSERT`
 * fait `coalesce(new.position, 0)` : ne rien envoyer ferait naître la tâche en
 * TÊTE de liste. Il faut donc une valeur — mais la modale est maintenant montée
 * globalement, et faire une requête « toutes les tâches » depuis l'Accueil ou la
 * Review pour un seul entier serait absurde.
 *
 * On la dérive donc du cache, comme `patchCachedTasks` dans `useTaskMutations` :
 * coût réseau nul. Le cache n'est jamais vide en pratique, la `Sidebar` montant
 * `useTasks('today')` et `useTasks('overdue')` sur les quatre routes.
 *
 * Rien n'exige que la valeur soit exacte : `position` est global au propriétaire
 * et non propre à la vue affichée, aucune contrainte d'unicité ne pèse dessus, et
 * `useReorderTasks` renormalise en `0..n-1` au premier glisser-déposer. Un ex æquo
 * est départagé par `created_at` — la nouvelle tâche passe donc bien après.
 */
export function nextTaskPosition(queryClient: QueryClient): number {
  let max = -1
  for (const [, tasks] of queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.task.all })) {
    for (const task of tasks ?? []) if (task.position > max) max = task.position
  }
  return max + 1
}
