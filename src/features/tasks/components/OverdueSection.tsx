import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { formatOverdueDelay, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { TaskListRow } from './TaskListRow'
import { TaskRowCompact } from './TaskRowCompact'

type OverdueSectionProps = {
  tasks: Task[]
  /** Ancre serveur : c'est elle qui date le retard, pas l'horloge du navigateur. */
  today: IsoDate
  objectiveSlotOf: (task: Task) => number | null | undefined
  /** Listes indexées par id, pour la pastille de chaque ligne. */
  listById: Map<string, List>
  /** Toutes les listes, pour le menu de la pastille en desktop. */
  lists: List[]
  onToggle: (task: Task) => void
  onRename: (task: Task, title: string) => void
  onToggleImportant: (task: Task) => void
  onPickList: (task: Task, listId: string | null) => void
  onPickDue: (task: Task, dueDate: IsoDate | null) => void
  onOpen: (task: Task) => void
  onDelete: (task: Task) => void
  /** Report en masse (SPEC §5) — tâches personnelles uniquement. */
  onPostponeAll: () => void
  postponing: boolean
  donePhaseFor: (taskId: string) => DonePhase | undefined
  reducedMotion: boolean
  className?: string
}

/**
 * Le retard a sa section, pas ses propres lignes : ce sont celles du reste de
 * l'écran, aux mêmes breakpoints, pour que les deux blocs se manipulent
 * pareil. Seule différence assumée — pas de poignée de glisser : l'ordre manuel
 * porte sur la liste entière, réordonner une sous-section ne veut rien dire.
 */
export function OverdueSection({
  tasks,
  today,
  objectiveSlotOf,
  listById,
  lists,
  onToggle,
  onRename,
  onToggleImportant,
  onPickList,
  onPickDue,
  onOpen,
  onDelete,
  onPostponeAll,
  postponing,
  donePhaseFor,
  reducedMotion,
  className,
}: OverdueSectionProps) {
  if (tasks.length === 0) return null

  const delayOf = (task: Task) =>
    task.due_date ? `En retard · ${formatOverdueDelay(task.due_date, today)}` : undefined
  const listOf = (task: Task) => (task.list_id ? listById.get(task.list_id) : undefined)

  return (
    <section className={className}>
      <div className="mb-0.5 flex items-center gap-3">
        <h2 className="text-[9.5px] font-semibold tracking-[1.3px] text-danger lg:text-[11px] lg:tracking-[1.2px]">
          EN RETARD ({tasks.length})
        </h2>
        <button
          type="button"
          onClick={onPostponeAll}
          disabled={postponing}
          title="Reporte vos tâches en retard à aujourd’hui. Les tâches partagées ne bougent pas."
          className={cn(
            'ml-auto cursor-pointer rounded-xs text-[11.5px] font-medium whitespace-nowrap text-danger',
            'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            'disabled:cursor-default disabled:opacity-60',
            'lg:ml-0 lg:rounded-2xl lg:bg-danger-bg lg:px-3 lg:py-[5px] lg:text-[11px] lg:hover:bg-[#fbdcc6]',
          )}
        >
          <span className="lg:hidden">Tout reporter →</span>
          <span className="hidden lg:inline">Tout reporter à aujourd’hui</span>
        </button>
      </div>

      <ul className="hidden flex-col lg:flex">
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            objectiveSlot={objectiveSlotOf(task)}
            list={listOf(task)}
            lists={lists}
            today={today}
            canDrag={false}
            donePhase={donePhaseFor(task.id)}
            reducedMotion={reducedMotion}
            overdueLabel={delayOf(task)}
            onToggle={onToggle}
            onRename={onRename}
            onToggleImportant={onToggleImportant}
            onPickList={onPickList}
            onPickDue={onPickDue}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </ul>

      <ul className="flex flex-col lg:hidden">
        {tasks.map((task) => (
          <TaskRowCompact
            key={task.id}
            task={task}
            objectiveSlot={objectiveSlotOf(task)}
            list={listOf(task)}
            donePhase={donePhaseFor(task.id)}
            reducedMotion={reducedMotion}
            overdueLabel={delayOf(task)}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  )
}
