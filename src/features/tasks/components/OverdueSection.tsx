import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { DonePhase } from '../../../components/tasks/taskDone'
import type { Task } from '../../../hooks/useTasks'
import { formatOverdueDelay, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'

type OverdueSectionProps = {
  tasks: Task[]
  /** Ancre serveur : c'est elle qui date le retard, pas l'horloge du navigateur. */
  today: IsoDate
  objectiveSlotOf: (task: Task) => number | null | undefined
  onToggle: (task: Task) => void
  /** Report en masse (SPEC §5) — tâches personnelles uniquement. */
  onPostponeAll: () => void
  postponing: boolean
  donePhaseFor: (taskId: string) => DonePhase | undefined
  reducedMotion: boolean
  className?: string
}

export function OverdueSection({
  tasks,
  today,
  objectiveSlotOf,
  onToggle,
  onPostponeAll,
  postponing,
  donePhaseFor,
  reducedMotion,
  className,
}: OverdueSectionProps) {
  if (tasks.length === 0) return null

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

      <ul className="flex flex-col">
        {tasks.map((task, index) => {
          const slot = objectiveSlotOf(task)
          const accent = slot != null ? objectiveSkin(slot).core : null
          const donePhase = donePhaseFor(task.id)
          const done = task.completed_at !== null

          return (
            <li
              key={task.id}
              className={cn(
                'flex items-center gap-2.5 lg:gap-[13px]',
                'min-h-10 px-0.5 py-[7px] lg:min-h-0 lg:px-1 lg:py-[13px]',
                index < tasks.length - 1 && 'border-b border-surface-subtle lg:border-b-0',
                !reducedMotion && donePhase === 1 && 'animate-row-flash',
                !reducedMotion && donePhase === 2 && 'animate-row-collapse overflow-hidden',
              )}
            >
              <TaskCheckbox
                done={done}
                title={task.title}
                accent={accent}
                bursting={donePhase !== undefined && !reducedMotion}
                onToggle={() => onToggle(task)}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:gap-[3px]">
                <span
                  className={cn(
                    'truncate text-[12.5px] lg:text-[13px]',
                    done ? 'text-ink-muted line-through' : 'text-ink',
                  )}
                >
                  {task.title}
                </span>
                {task.due_date && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-danger">
                    <CalendarIcon className="size-3 shrink-0" />
                    En retard · {formatOverdueDelay(task.due_date, today)}
                  </span>
                )}
              </div>

              {task.space_id && (
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-[5px] rounded-2xl text-[9.5px] font-semibold',
                    'bg-accent-bg px-2 py-px text-accent',
                    'lg:border lg:border-border lg:bg-surface lg:px-[9px] lg:py-0.5 lg:text-ink-2',
                  )}
                >
                  <span aria-hidden className="hidden size-[5px] rounded-full bg-accent lg:block" />
                  Espace
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
