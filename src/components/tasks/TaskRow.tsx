import { cn } from '../../lib/cn'
import { ListPill } from './ListPill'
import { TaskCheckbox } from './TaskCheckbox'
import type { DonePhase } from './taskDone'
import type { List } from '../../hooks/useLists'
import type { Task } from '../../hooks/useTasks'
import { formatShortDate, type IsoDate } from '../../lib/appDate'
import { isRecurring, recurrenceLockReason } from '../../lib/recurrence'
import { taskRowSkin } from '../../components/tasks/taskRowSkin'

export type { DonePhase }

type TaskRowProps = {
  task: Task
  /** Ancre serveur, pour verrouiller la case d'une récurrente pas encore échue.
   *  Absente dans « En retard », où l'échéance est passée par définition. */
  today?: IsoDate
  /** Slot de l'objectif lié : donne sa couleur à la ligne et à la case. */
  objectiveSlot: number | null | undefined
  list: List | undefined
  onToggle: (task: Task) => void
  /** Sans lui, l'importance n'est qu'un badge : c'est ce qui la rend cliquable,
   *  au même endroit que sur l'écran Tâches. */
  onToggleImportant?: (task: Task) => void
  /** Affiche l'échéance en rouge (bloc « en retard »). */
  showDueDate?: boolean
  last?: boolean
  /** Phase de sortie quand la tâche vient d'être cochée. */
  donePhase?: DonePhase
  /** Coupe les effets décoratifs (préférence de mouvement réduit). */
  reducedMotion?: boolean
}

export function TaskRow({
  task,
  today,
  objectiveSlot,
  list,
  onToggle,
  onToggleImportant,
  showDueDate = false,
  last = false,
  donePhase,
  reducedMotion = false,
}: TaskRowProps) {
  const done = task.completed_at !== null
  const { accent, linked, bursting, doneClasses, style } = taskRowSkin({
    objectiveSlot,
    done,
    donePhase,
    reducedMotion,
  })

  return (
    <div
      className={cn(
        // Métriques de la maquette : gap et padding vertical à 13 px en desktop.
        // En mobile, la ligne suit l'échelle de l'écran Tâches (OverdueSection).
        'group flex items-center gap-2.5 py-2.5 pr-2.5 lg:gap-[13px] lg:py-[13px]',
        !last && 'border-b border-surface-subtle',
        linked ? 'border-l-[3px] pl-3.5' : 'pl-[17px]',
        doneClasses,
      )}
      style={style}
    >
      <TaskCheckbox
        done={done}
        title={task.title}
        accent={accent}
        bursting={bursting}
        lockedReason={today ? recurrenceLockReason(task, today) : null}
        onToggle={() => onToggle(task)}
      />

      {/* L'importance se marque au plus près de la case, comme sur l'écran
          Tâches. Elle se masque par `invisible` et non par un rendu
          conditionnel : le titre reste aligné d'une ligne à l'autre. */}
      {onToggleImportant ? (
        <button
          type="button"
          aria-pressed={task.is_important}
          aria-label="Marquer comme important"
          onClick={() => onToggleImportant(task)}
          className={cn(
            'shrink-0 cursor-pointer text-[16px] leading-none transition-colors duration-150',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            task.is_important
              ? 'text-danger'
              : 'invisible text-[#b8b8b0] group-focus-within:visible group-hover:visible hover:text-ink-muted',
          )}
        >
          <span aria-hidden>⚑</span>
        </button>
      ) : (
        task.is_important && (
          <span className="shrink-0 text-[16px] leading-none text-danger" title="Important">
            <span aria-hidden>⚑</span>
            <span className="sr-only">Important</span>
          </span>
        )
      )}

      {/* Titre et méta empilés en mobile, remis sur une seule ligne en desktop :
          le bloc de méta ne rétrécit pas, il pousserait sinon la carte au-delà
          du viewport. Même parti que `OverdueSection` sur l'écran Tâches. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-[13px]">
        <span
          className={cn(
            'w-full min-w-0 truncate text-[12.5px] transition-colors duration-300 lg:flex-1 lg:text-[13px]',
            done ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {task.title}
        </span>

        <div className="flex min-w-0 items-center gap-2 lg:shrink-0">
          {list && <ListPill name={list.name} color={list.color} size="sm" />}
          {isRecurring(task.recurrence) && (
            <span
              className="shrink-0 text-[14px] text-ink-muted lg:text-[16px]"
              title="Tâche récurrente"
              aria-hidden="true"
            >
              ↻
            </span>
          )}
          {showDueDate && task.due_date && (
            <span className="shrink-0 text-caption font-semibold text-danger">
              {formatShortDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
