// Ce qu'une tâche est par rapport à un jour : due ce jour-là, en retard.
//
// Une seule définition, partagée par l'écran Tâches (`taskScope.ts`, vue
// « Aujourd'hui » et section « En retard ») et par « Ma journée ». Elle a un
// MIROIR SERVEUR, `private.day_task_counts` (migration day_push), qui compte la
// même chose pour le texte de la notification du matin : toute évolution d'ici
// doit y être reportée.
import type { IsoDate } from './appDate'
import { sortTasks } from './taskSort'
import type { Task } from '../hooks/useTasks'

type Dated = Pick<Task, 'due_date'>

/** Due ce jour-là. Cochée ou non : le filtre de complétion est laissé à l'appelant. */
export function isDueOn(task: Dated, day: IsoDate): boolean {
  return task.due_date === day
}

/**
 * Échéance passée. Le filtre de complétion est laissé à l'appelant : une tâche
 * qu'on vient de cocher reste affichée le temps de son animation de sortie.
 */
export function isPastDue(task: Dated, today: IsoDate): boolean {
  return task.due_date !== null && task.due_date < today
}

export type DaySections = {
  /** En retard, cochées aujourd'hui comprises, par échéance puis ordre manuel. */
  overdue: Task[]
  /** Dues aujourd'hui, cochées comprises, dans l'ordre manuel de /taches. */
  dueToday: Task[]
  /** Ce qui reste à faire dans les deux blocs. */
  pending: number
}

/**
 * Les tâches de « Ma journée » : la vue « Aujourd'hui » de /taches et sa section
 * « En retard », triées comme elles (`sortTasks`).
 *
 * Une différence, voulue : une tâche cochée aujourd'hui RESTE dans son bloc, y
 * compris en retard. « Ma journée » est le bilan du jour, pas une liste qui se
 * vide. Le jeu doit être chargé avec `completedSince` = début du jour : une tâche
 * cochée qui y figure l'a donc été aujourd'hui.
 */
export function daySections(tasks: Task[], today: IsoDate): DaySections {
  const overdue = sortTasks(
    tasks.filter((t) => isPastDue(t, today)),
    'manual',
    { groupByDate: true },
  )
  const dueToday = sortTasks(
    tasks.filter((t) => isDueOn(t, today)),
    'manual',
  )
  const pending = [...overdue, ...dueToday].filter((t) => t.completed_at === null).length
  return { overdue, dueToday, pending }
}
