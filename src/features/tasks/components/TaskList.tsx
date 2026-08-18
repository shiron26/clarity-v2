import { Fragment, type KeyboardEvent, type PointerEvent } from 'react'
import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { formatDayHeader, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import type { TaskAge } from '../../../lib/taskAge'
import { TaskListRow } from './TaskListRow'
import { TaskRowCompact } from './TaskRowCompact'

/**
 * L'en-tête qui ouvre un groupe, ou `null` si la ligne prolonge le précédent.
 *
 * Les tâches sans échéance ferment la marche (`sortTasks` les met en dernier) :
 * sans leur propre en-tête, elles se liraient comme datées du dernier jour
 * affiché.
 */
function headerBefore(task: Task, previous: Task | undefined): string | null {
  if (task.due_date === null) {
    // Capitales comme les en-têtes de jour : `formatDayHeader` rend « LUN. 17 AOÛT ».
    return previous === undefined || previous.due_date !== null ? 'SANS DATE' : null
  }
  return task.due_date === previous?.due_date ? null : formatDayHeader(task.due_date)
}

/** Ce que toute ligne sait faire — assemblé une fois par la page, pour que la
 *  liste principale et la section « en retard » réagissent à l'identique. */
export type TaskRowActions = {
  lists: List[]
  today: IsoDate
  reducedMotion: boolean
  onToggle: (task: Task) => void
  onToggleImportant: (task: Task) => void
  onPickList: (task: Task, listId: string | null) => void
  onPickDue: (task: Task, dueDate: IsoDate | null) => void
  onOpen: (task: Task) => void
  onDelete: (task: Task) => void
}

type TaskListProps = TaskRowActions & {
  tasks: Task[]
  objectiveSlotOf: (task: Task) => number | null | undefined
  listById: Map<string, List>
  /** Ancienneté à afficher, ou `null` — la vue « Sans date » est la seule à en
   *  vouloir : ailleurs, l'échéance parle déjà. */
  ageOf: (task: Task) => TaskAge | null
  /** Les lignes sont-elles groupées sous un en-tête de jour ? */
  grouped: boolean
  canDrag: boolean
  donePhaseFor: (taskId: string) => DonePhase | undefined
  dragId: string | null
  grabbedId: string | null
  onGripPointerDown: (event: PointerEvent<HTMLButtonElement>, task: Task) => void
  onGripKeyDown: (event: KeyboardEvent<HTMLButtonElement>, task: Task) => void
}

/**
 * La liste de tâches, aux deux largeurs. Deux `<ul>` plutôt qu'un seul : les
 * lignes desktop et mobile n'offrent pas les mêmes gestes (le doigt n'a pas de
 * survol). Le regroupement par jour, lui, est commun : le tri met déjà les
 * lignes en ordre d'échéance des deux côtés, et sans en-tête le mobile donnait
 * à lire une liste qui semblait dans le désordre.
 */
export function TaskList({
  tasks,
  objectiveSlotOf,
  listById,
  ageOf,
  grouped,
  canDrag,
  donePhaseFor,
  dragId,
  grabbedId,
  onGripPointerDown,
  onGripKeyDown,
  ...rowActions
}: TaskListProps) {
  const listOf = (task: Task) => (task.list_id ? listById.get(task.list_id) : undefined)

  return (
    <>
      <ul className="hidden flex-col lg:flex">
        {tasks.map((task, index) => {
          const header = grouped ? headerBefore(task, tasks[index - 1]) : null

          return (
            <Fragment key={task.id}>
              {header && (
                <li
                  aria-hidden
                  className={cn(
                    'px-1 pb-1.5 text-[9.5px] font-semibold tracking-[1.3px] text-ink-muted',
                    index === 0 ? 'pt-1' : 'pt-4',
                  )}
                >
                  {header}
                </li>
              )}
              <TaskListRow
                {...rowActions}
                task={task}
                objectiveSlot={objectiveSlotOf(task)}
                list={listOf(task)}
                age={ageOf(task) ?? undefined}
                canDrag={canDrag}
                dragging={dragId === task.id}
                grabbed={grabbedId === task.id}
                donePhase={donePhaseFor(task.id)}
                onGripPointerDown={onGripPointerDown}
                onGripKeyDown={onGripKeyDown}
              />
            </Fragment>
          )
        })}
      </ul>

      <ul className="flex flex-col lg:hidden">
        {tasks.map((task, index) => {
          const header = grouped ? headerBefore(task, tasks[index - 1]) : null

          return (
            <Fragment key={task.id}>
              {header && (
                <li
                  aria-hidden
                  className={cn(
                    'px-3.5 pb-1 text-[9.5px] font-semibold tracking-[1.3px] text-ink-muted',
                    index === 0 ? 'pt-1' : 'pt-3.5',
                  )}
                >
                  {header}
                </li>
              )}
              <TaskRowCompact
                task={task}
                objectiveSlot={objectiveSlotOf(task)}
                list={listOf(task)}
                age={ageOf(task) ?? undefined}
                donePhase={donePhaseFor(task.id)}
                reducedMotion={rowActions.reducedMotion}
                onToggle={rowActions.onToggle}
                onOpen={rowActions.onOpen}
              />
            </Fragment>
          )
        })}
      </ul>
    </>
  )
}
