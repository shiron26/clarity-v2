import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { ListPill } from '../../../components/tasks/ListPill'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { cn } from '../../../lib/cn'
import type { TaskAge } from '../../../lib/taskAge'
import { taskRowSkin } from '../../../components/tasks/taskRowSkin'

type TaskRowCompactProps = {
  task: Task
  objectiveSlot: number | null | undefined
  list: List | undefined
  donePhase?: DonePhase
  reducedMotion?: boolean
  /** « En retard · Hier » — posé par la section du même nom, absent ailleurs. Le
   *  délai est calculé par l'appelant, qui seul connaît l'ancre serveur. */
  overdueLabel?: string
  /** Ancienneté, en vue « Sans date » seulement (REFONTE §5). */
  age?: TaskAge
  onToggle: (task: Task) => void
  /** Toucher la ligne ouvre la feuille d'édition (maquette mobile). */
  onOpen: (task: Task) => void
}

/**
 * Ligne mobile : plus dense, sans affordance de survol — le doigt n'en a pas.
 * Les métadonnées passent sur une seconde ligne sous le titre.
 *
 * **Pas de filet entre les lignes**, comme en desktop : la hauteur de ligne et
 * la case à cocher suffisent à les séparer, et un trait sous chacune redonnait à
 * la liste mobile l'air de tableau que le reste du produit n'a pas. Les seuls
 * traits qui restent sont ceux qui séparent des SECTIONS (le retard du reste de
 * la liste), et ceux-là portent du sens.
 */
export function TaskRowCompact({
  task,
  objectiveSlot,
  list,
  donePhase,
  reducedMotion = false,
  overdueLabel,
  age,
  onToggle,
  onOpen,
}: TaskRowCompactProps) {
  const done = task.completed_at !== null
  const { accent, linked, bursting, doneClasses, style } = taskRowSkin({
    objectiveSlot,
    done,
    donePhase,
    reducedMotion,
  })

  const hasMeta =
    !!overdueLabel ||
    !!age ||
    !!list ||
    task.recurrence != null ||
    task.is_important ||
    !!task.space_id

  return (
    <li
      data-task-row={task.id}
      className={cn(
        'flex min-h-11 items-center gap-2.5 py-2.5 pr-2',
        linked ? 'border-l-[3px] pl-3' : 'pl-3.5',
        doneClasses,
      )}
      style={style}
    >
      <TaskCheckbox
        done={done}
        title={task.title}
        accent={accent}
        compact
        bursting={bursting}
        onToggle={() => onToggle(task)}
      />

      <button
        type="button"
        onClick={() => onOpen(task)}
        aria-label={`Ouvrir ${task.title}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 rounded-xs text-left focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
      >
        <span
          className={cn(
            'w-full truncate text-[12.5px] transition-colors duration-300',
            done ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {task.title}
        </span>

        {hasMeta && (
          <span className="flex min-w-0 items-center gap-1.5">
            {overdueLabel && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-danger">
                <CalendarIcon className="size-3 shrink-0" />
                {overdueLabel}
              </span>
            )}
            {list && <ListPill name={list.name} color={list.color} size="sm" />}
            {age && (
              <span title={age.long} className="shrink-0 text-[11px] text-ink-muted">
                <span aria-hidden>{age.short}</span>
                <span className="sr-only">{age.long}</span>
              </span>
            )}
            {task.recurrence != null && (
              <span className="text-[14px] text-ink-muted" aria-hidden>
                ↻
              </span>
            )}
            {task.space_id && (
              <span className="rounded-2xl bg-accent-bg px-2 py-px text-micro font-bold text-accent">
                Espace
              </span>
            )}
            {task.is_important && (
              <span className="text-[13px] text-danger" aria-hidden title="Important">
                ⚑
              </span>
            )}
          </span>
        )}
      </button>
    </li>
  )
}
