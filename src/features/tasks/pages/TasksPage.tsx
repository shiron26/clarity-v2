import { TasksView } from '../components/TasksView'

// La page ne fait que monter la vue : toutes les requêtes et tout l'état d'écran
// vivent dans `TasksView` (même découpage que `HomePage` / `DashboardView`).
export function TasksPage() {
  return <TasksView />
}
