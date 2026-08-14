// Les vues de l'écran Tâches sont des prédicats purs sur le même jeu de lignes
// (SPEC §5 : « un même jeu de tâches vu à travers des prédicats différents »).
// L'écran charge `useTasks('all')` une fois et filtre en mémoire : la sous-navigation
// et la feuille mobile affichent des compteurs pour toutes les vues, et la
// recherche porte sur l'ensemble — cinq requêtes filtrées re-téléchargeraient les
// mêmes lignes et pourraient se contredire pendant une invalidation.
import { addDays, endOfWeek, type IsoDate } from '../../lib/appDate'
import type { Task } from '../../hooks/useTasks'

/** Les portées de la maquette. « Demain » n'a pas d'entrée de navigation : on y
 *  accède par la bascule de l'en-tête de la carte, en vue jour. « En retard »
 *  n'en est pas une non plus — le retard vit dans sa propre section. */
/**
 * Compartiment de date des vues multi-jours : les tâches datées, groupées par
 * jour, ou celles qui n'ont pas d'échéance. Un filtre d'écran, jamais persisté.
 */
export type DateBucket = 'dated' | 'undated'

export type TaskScope = 'today' | 'tomorrow' | 'week' | 'all' | 'list'

export const SCOPE_TITLES: Record<Exclude<TaskScope, 'list'>, string> = {
  today: 'Aujourd’hui',
  tomorrow: 'Demain',
  week: 'Cette semaine',
  all: 'Toutes les tâches',
}

export const SCOPE_NAV_LABELS: Record<Exclude<TaskScope, 'list'>, string> = {
  today: 'Aujourd’hui',
  tomorrow: 'Demain',
  week: 'Cette semaine',
  all: 'Toutes',
}

/**
 * Vue « jour » : une seule date à l'écran. C'est ce qui distingue les deux
 * régimes d'affichage de la liste — une vue jour est une liste plate qu'on peut
 * réordonner à la main, une vue multi-jours est groupée par échéance (l'ordre y
 * est imposé par la date) et porte la section repliable « Sans date ».
 */
export function isDayScope(scope: TaskScope): boolean {
  return scope === 'today' || scope === 'tomorrow'
}

/**
 * Échéance passée. Le filtre de complétion est laissé à l'appelant : une tâche
 * qu'on vient de cocher reste affichée le temps de son animation de sortie.
 */
export function isPastDue(task: Task, today: IsoDate): boolean {
  return task.due_date !== null && task.due_date < today
}

/**
 * Portée d'une vue (SPEC §5). Le retard en est **exclu** : il a sa propre
 * section, dans toutes les vues — sans quoi « Aujourd'hui » listerait aussi
 * toutes les tâches cochées des mois précédents.
 */
export function matchesScope(
  task: Task,
  scope: TaskScope,
  options: { today: IsoDate; listId?: string | null },
): boolean {
  const { today, listId } = options
  switch (scope) {
    case 'today':
      return task.due_date === today
    case 'tomorrow':
      return task.due_date === addDays(today, 1)
    case 'week':
      // Fenêtre qui rétrécit au fil de la semaine : d'aujourd'hui à dimanche.
      return task.due_date !== null && task.due_date >= today && task.due_date <= endOfWeek(today)
    case 'list':
      return !!listId && task.list_id === listId
    case 'all':
      return true
  }
}

/**
 * Bloc « en retard », commun à toutes les vues **sauf « Demain »** : cette vue
 * regarde devant, y afficher du retard n'aurait pas de sens (maquette). Il n'est
 * borné que par la liste quand on regarde une liste : le retard d'une autre
 * liste n'y a rien à faire.
 */
export function inOverdueScope(
  task: Task,
  scope: TaskScope,
  options: { today: IsoDate; listId?: string | null },
): boolean {
  if (scope === 'tomorrow') return false
  if (!isPastDue(task, options.today)) return false
  return scope === 'list' ? task.list_id === options.listId : true
}

/**
 * Compteur de vue : ce qui reste à faire. « Aujourd'hui » et « Cette semaine »
 * comptent aussi le retard, puisqu'elles l'affichent (comme le badge de la
 * sidebar).
 */
export function pendingCount(
  tasks: Task[],
  scope: TaskScope,
  options: { today: IsoDate; listId?: string | null },
): number {
  const withOverdue = scope === 'today' || scope === 'week'
  return tasks.filter(
    (t) =>
      t.completed_at === null &&
      (matchesScope(t, scope, options) || (withOverdue && isPastDue(t, options.today))),
  ).length
}

/**
 * Recherche client sur les titres (SPEC §5 : côté client — les titres sont
 * chiffrés en base — et sur les tâches actives uniquement). Insensible à la
 * casse et aux accents.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function matchesSearch(task: Task, query: string): boolean {
  const needle = normalizeForSearch(query.trim())
  if (!needle) return true
  if (task.completed_at !== null) return false
  return normalizeForSearch(task.title).includes(needle)
}
