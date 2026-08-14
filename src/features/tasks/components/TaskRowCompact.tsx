import { ListPill } from '../../../components/tasks/ListPill'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'

type TaskRowCompactProps = {
  task: Task
  objectiveSlot: number | null | undefined
  list: List | undefined
  donePhase?: DonePhase
  reducedMotion?: boolean
  onToggle: (task: Task) => void
  /** Toucher la ligne ouvre la feuille d'édition (maquette mobile). */
  onOpen: (task: Task) => void
}

/**
 * Ligne mobile : plus dense, sans affordance de survol — le doigt n'en a pas.
 * Les métadonnées passent sur une seconde ligne sous le titre.
 */
export function TaskRowCompact({
  task,
  objectiveSlot,
  list,
  donePhase,
  reducedMotion = false,
  onToggle,
  onOpen,
}: TaskRowCompactProps) {
  const done = task.completed_at !== null
  const accent = objectiveSlot != null ? objectiveSkin(objectiveSlot).core : null
  const linked = accent !== null && !done
  const bursting = donePhase !== undefined && !reducedMotion

  const hasMeta = !!list || task.recurrence != null || task.is_important || !!task.space_id

  return (
    <li
      data-task-row={task.id}
      className={cn(
        'flex min-h-11 items-center gap-2.5 border-b border-surface-subtle py-2.5 pr-2',
        linked ? 'border-l-[3px] pl-3' : 'pl-3.5',
        !reducedMotion && donePhase === 1 && 'animate-row-flash',
        !reducedMotion && donePhase === 2 && 'animate-row-collapse overflow-hidden',
      )}
      style={
        linked && accent
          ? {
              borderLeftColor: accent,
              backgroundImage: `linear-gradient(90deg,${accent}0d,transparent 60%)`,
            }
          : undefined
      }
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
          <span className="flex items-center gap-1.5">
            {list && <ListPill name={list.name} color={list.color} size="sm" />}
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
