// Tri de la liste de tâches. Comparateurs purs, aucune persistance : la SPEC §5
// est explicite — « tris et filtres non mémorisés, aucune préférence à stocker ».
import type { Task } from '../../hooks/useTasks'

export type SortMode = 'manual' | 'prio'

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manuel',
  prio: 'Priorité',
}

/**
 * Les deux seuls tris offerts, dans toutes les vues. Le tri par date a disparu
 * de la maquette v2 : dans les vues multi-jours, le **regroupement par jour**
 * l'assure déjà (`groupByDate` ci-dessous) — le proposer en option laissait
 * croire à un choix qui n'en était pas un.
 */
export const SORT_OPTIONS: SortMode[] = ['manual', 'prio']

/** Le tri par défaut, quelle que soit la vue. */
export const DEFAULT_SORT: SortMode = 'manual'

/** Une échéance absente passe après toutes les autres. */
function byDueDate(a: Task, b: Task): number {
  if (a.due_date === b.due_date) return 0
  if (a.due_date === null) return 1
  if (b.due_date === null) return -1
  return a.due_date < b.due_date ? -1 : 1
}

/**
 * `groupByDate` : l'échéance devient la clé primaire, avant le mode choisi. Les
 * vues multi-jours en dépendent — leurs en-têtes `MER. 13 AOÛT` supposent des
 * lignes déjà contiguës par jour, et les tâches sans date fermant la marche.
 *
 * `position` est l'ordre manuel ; il départage aussi les ex æquo de l'autre
 * tri, pour qu'un rendu ne s'échange jamais deux lignes au hasard.
 */
export function sortTasks(
  tasks: Task[],
  mode: SortMode,
  options: { groupByDate: boolean } = { groupByDate: false },
): Task[] {
  const sorted = [...tasks]
  sorted.sort((a, b) => {
    if (options.groupByDate) {
      const due = byDueDate(a, b)
      if (due !== 0) return due
    }
    if (mode === 'prio') {
      const flag = Number(b.is_important) - Number(a.is_important)
      if (flag !== 0) return flag
    }
    return a.position - b.position
  })
  return sorted
}
