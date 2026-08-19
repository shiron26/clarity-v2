import { createContext, useContext } from 'react'
import type { IsoDate } from '../../lib/appDate'
import type { Task } from '../../hooks/useTasks'
import type { DonePhase } from '../../components/tasks/TaskRow'

/**
 * Ce que la page prête à ses widgets.
 *
 * Un widget est autonome pour ses DONNÉES — il porte ses queries, son état vide
 * et son erreur — parce qu'il peut ne pas être monté du tout et que la page n'a
 * pas à charger pour lui. Il est en revanche dépendant de la page pour les
 * INTERACTIONS : cocher une tâche dans « Aujourd'hui » allume la carte de
 * l'objectif dans un autre widget, et cette liaison disparaîtrait si chacun
 * portait sa propre séquence de célébration.
 */
export type DashboardCtx = {
  today: IsoDate
  privacy: boolean
  reducedMotion: boolean
  onToggleTask: (task: Task) => void
  onToggleImportant: (task: Task) => void
  donePhaseFor: (taskId: string) => DonePhase | undefined
  /** Objectif dont la carte doit se rallumer, juste après une complétion. */
  poppingObjectiveId: string | null
  /** Une tâche cochée reste visible le temps de l'animation, puis se retire. */
  isVisible: (task: Task) => boolean
}

export const DashboardContext = createContext<DashboardCtx | null>(null)

export function useDashboardCtx() {
  const value = useContext(DashboardContext)
  if (!value) {
    throw new Error('useDashboardCtx doit être utilisé sous <DashboardContext>')
  }
  return value
}
