// Les vues de l'écran Tâches sont des prédicats purs sur le même jeu de lignes
// (SPEC §5 : « un même jeu de tâches vu à travers des prédicats différents »).
// L'écran charge `useTasks('all')` une fois et filtre en mémoire : la sous-navigation
// et la feuille mobile affichent des compteurs pour toutes les vues, et la
// recherche porte sur l'ensemble — cinq requêtes filtrées re-téléchargeraient les
// mêmes lignes et pourraient se contredire pendant une invalidation.
import { endOfWeek, type IsoDate } from '../../lib/appDate'
import type { Task } from '../../hooks/useTasks'

/**
 * Les quatre vues de la maquette (REFONTE §5). « En retard » n'en est pas une :
 * le retard vit dans sa propre section, présente dans toutes les vues qui
 * regardent une date.
 *
 * La liste n'est **pas** une cinquième vue : c'est un filtre orthogonal, qui se
 * combine avec la vue au lieu de la remplacer (`?vue=semaine&liste=<uuid>`).
 * Les quatre onglets sont le seul endroit où l'on choisit la portée : dans une
 * liste, ils doivent filtrer dedans, pas en sortir.
 *
 * « Sans date » est le **pool** : ce qu'on a capturé sans rien promettre. C'est
 * la contrepartie du principe « capturer n'est pas planifier » — une tâche non
 * datée crédite le jour où on la coche, la progression n'exige aucune
 * planification.
 */
export type TaskScope = 'today' | 'week' | 'undated' | 'all'

export const SCOPE_TITLES: Record<TaskScope, string> = {
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  undated: 'Sans date',
  all: 'Toutes les tâches',
}

export const SCOPE_NAV_LABELS: Record<TaskScope, string> = {
  today: 'Aujourd’hui',
  week: 'Cette semaine',
  undated: 'Sans date',
  all: 'Toutes',
}

/** Libellés du sélecteur mobile, plus courts que la navigation (maquette). */
export const SCOPE_SEGMENT_LABELS: Record<TaskScope, string> = {
  today: 'Aujourd’hui',
  week: 'Semaine',
  undated: 'Sans date',
  all: 'Toutes',
}

/** L'ordre des vues à l'écran. */
export const SCOPE_ORDER: TaskScope[] = ['today', 'week', 'undated', 'all']

/** Ce que le sélecteur mobile montre : trois vues, pas quatre. Sur 390 px, une
 *  quatrième pastille tomberait à deux lettres — « Toutes » et les listes
 *  restent dans la feuille de vues (maquette). */
export const MOBILE_SCOPE_ORDER: TaskScope[] = ['today', 'week', 'undated']

/**
 * Une liste plate, réordonnable à la main : aucune échéance n'y impose déjà un
 * ordre. « Aujourd'hui » n'a qu'une date, « Sans date » n'en a aucune.
 *
 * Les autres vues groupent par échéance sous un en-tête de jour — y glisser une
 * ligne d'un jour vers un autre la ramènerait aussitôt dans son groupe.
 */
export function isFlatScope(scope: TaskScope): boolean {
  return scope === 'today' || scope === 'undated'
}

/**
 * Échéance passée. Le filtre de complétion est laissé à l'appelant : une tâche
 * qu'on vient de cocher reste affichée le temps de son animation de sortie.
 */
export function isPastDue(task: Task, today: IsoDate): boolean {
  return task.due_date !== null && task.due_date < today
}

/** La liste sélectionnée, quand il y en a une, restreint toutes les vues. */
export function matchesList(task: Task, listId?: string | null): boolean {
  return !listId || task.list_id === listId
}

/**
 * Portée d'une vue (SPEC §5), restreinte à la liste ouverte s'il y en a une. Le
 * retard en est **exclu** : il a sa propre section, dans toutes les vues — sans
 * quoi « Aujourd'hui » listerait aussi toutes les tâches cochées des mois
 * précédents.
 */
export function matchesScope(
  task: Task,
  scope: TaskScope,
  options: { today: IsoDate; listId?: string | null },
): boolean {
  const { today, listId } = options
  if (!matchesList(task, listId)) return false
  switch (scope) {
    case 'today':
      return task.due_date === today
    case 'week':
      // Fenêtre qui rétrécit au fil de la semaine : d'aujourd'hui à dimanche.
      return task.due_date !== null && task.due_date >= today && task.due_date <= endOfWeek(today)
    case 'undated':
      return task.due_date === null
    case 'all':
      return true
  }
}

/**
 * Bloc « en retard », commun à toutes les vues **sauf « Sans date »** : une
 * tâche en retard porte une échéance, elle n'appartient donc pas au pool. Il
 * n'est borné que par la liste quand on regarde une liste : le retard d'une
 * autre liste n'y a rien à faire.
 */
export function inOverdueScope(
  task: Task,
  scope: TaskScope,
  options: { today: IsoDate; listId?: string | null },
): boolean {
  if (scope === 'undated') return false
  if (!isPastDue(task, options.today)) return false
  return matchesList(task, options.listId)
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
      (matchesScope(t, scope, options) ||
        (withOverdue && isPastDue(t, options.today) && matchesList(t, options.listId))),
  ).length
}

/**
 * Recherche client sur les titres (SPEC §5 : côté client — les titres sont
 * chiffrés en base — et sur les tâches actives uniquement). Insensible à la
 * casse et aux accents.
 */
function normalizeForSearch(value: string): string {
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
