// Ce qui reste à traiter aujourd'hui, retards compris : le badge « Tâches » de
// la sidebar et la pastille de l'icône de l'app. Même compte que
// `private.day_task_counts` côté serveur, qui pose la pastille au push du matin :
// les deux doivent évoluer ensemble.
import { useAppToday } from './useAppToday'
import { useTasks } from './useTasks'

/** `undefined` tant que l'une des deux listes n'est pas chargée. */
export function usePendingTodayCount(): number | undefined {
  const today = useAppToday().data
  const todayTasks = useTasks('today', { today })
  const overdueTasks = useTasks('overdue', { today })
  if (todayTasks.data === undefined || overdueTasks.data === undefined) return undefined
  // La vue « overdue » ne rapatrie que les tâches non cochées.
  return todayTasks.data.filter((t) => t.completed_at === null).length + overdueTasks.data.length
}
