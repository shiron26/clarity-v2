import { cn } from '../../../lib/cn'
import { ListPill } from '../../../components/tasks/ListPill'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { formatShortDate } from '../../../lib/appDate'
import { objectiveSkin } from '../../../lib/objectivePalette'

export type { DonePhase }

type TaskRowProps = {
  task: Task
  /** Slot de l'objectif lié : donne sa couleur à la ligne et à la case. */
  objectiveSlot: number | null | undefined
  list: List | undefined
  onToggle: (task: Task) => void
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
  objectiveSlot,
  list,
  onToggle,
  showDueDate = false,
  last = false,
  donePhase,
  reducedMotion = false,
}: TaskRowProps) {
  const done = task.completed_at !== null
  // Une tâche liée à un objectif porte sa couleur : chaque coche fait avancer
  // quelque chose de visible.
  const accent = objectiveSlot != null ? objectiveSkin(objectiveSlot).core : null
  const linked = accent !== null && !done
  const bursting = donePhase !== undefined && !reducedMotion

  return (
    <div
      className={cn(
        // Métriques de la maquette : gap et padding vertical à 13 px.
        'flex items-center gap-[13px] py-[13px] pr-2.5',
        !last && 'border-b border-surface-subtle',
        linked ? 'border-l-[3px] pl-3.5' : 'pl-[17px]',
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
        bursting={bursting}
        onToggle={() => onToggle(task)}
      />

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[13px] transition-colors duration-300',
          done ? 'text-ink-muted line-through' : 'text-ink',
        )}
      >
        {task.title}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {list && <ListPill name={list.name} color={list.color} size="sm" />}
        {task.recurrence != null && (
          <span className="text-[16px] text-ink-muted" title="Tâche récurrente" aria-hidden="true">
            ↻
          </span>
        )}
        {task.is_important && (
          <span className="text-[16px] text-danger" title="Important" aria-hidden="true">
            ⚑
          </span>
        )}
        {showDueDate && task.due_date && (
          <span className="text-caption font-semibold text-danger">
            {formatShortDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}
