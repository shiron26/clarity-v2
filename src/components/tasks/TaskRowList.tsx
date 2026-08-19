import type { DonePhase } from './taskDone'
import { TaskRow } from './TaskRow'
import type { List } from '../../hooks/useLists'
import type { Objective } from '../../hooks/useObjectives'
import type { Task } from '../../hooks/useTasks'
import type { IsoDate } from '../../lib/appDate'

export type TaskRowListProps = {
  tasks: Task[]
  /** Relayée à chaque ligne : verrouille la case d'une récurrente pas encore
   *  échue. Inutile dans « En retard ». */
  today?: IsoDate
  /** Indexés par id : la ligne y retrouve le slot de son objectif et sa liste. */
  objectives: Map<string, Objective>
  lists: Map<string, List>
  onToggle: (task: Task) => void
  onToggleImportant?: (task: Task) => void
  /** Vrai pour « En retard » : ailleurs, la date du jour n'apprend rien. */
  showDueDate?: boolean
  donePhaseFor?: (taskId: string) => DonePhase | undefined
  reducedMotion?: boolean
}

/**
 * Une pile de lignes de tâches, telle que le dashboard l'affiche.
 *
 * Les deux blocs du dashboard (« Aujourd'hui » et « En retard ») portaient le
 * même `map` au caractère près : même résolution de l'objectif et de la liste,
 * même `last`, même relais de `donePhase`. Seul `showDueDate` les séparait.
 */
export function TaskRowList({
  tasks,
  today,
  objectives,
  lists,
  onToggle,
  onToggleImportant,
  showDueDate = false,
  donePhaseFor,
  reducedMotion,
}: TaskRowListProps) {
  return (
    <div className="flex flex-col">
      {tasks.map((task, i) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          objectiveSlot={task.objective_id ? objectives.get(task.objective_id)?.slot : undefined}
          list={task.list_id ? lists.get(task.list_id) : undefined}
          onToggle={onToggle}
          onToggleImportant={onToggleImportant}
          showDueDate={showDueDate}
          last={i === tasks.length - 1}
          donePhase={donePhaseFor?.(task.id)}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  )
}
