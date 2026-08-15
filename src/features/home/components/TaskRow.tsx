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
        // Métriques de la maquette : gap et padding vertical à 13 px en desktop.
        // En mobile, la ligne suit l'échelle de l'écran Tâches (OverdueSection).
        'flex items-center gap-2.5 py-2.5 pr-2.5 lg:gap-[13px] lg:py-[13px]',
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
          {task.recurrence != null && (
            <span
              className="shrink-0 text-[14px] text-ink-muted lg:text-[16px]"
              title="Tâche récurrente"
              aria-hidden="true"
            >
              ↻
            </span>
          )}
          {task.is_important && (
            <span
              className="shrink-0 text-[14px] text-danger lg:text-[16px]"
              title="Important"
              aria-hidden="true"
            >
              ⚑
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
