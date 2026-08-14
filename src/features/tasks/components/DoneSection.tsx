import { useId, useState } from 'react'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { Task } from '../../../hooks/useTasks'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'

type DoneSectionProps = {
  tasks: Task[]
  objectiveSlotOf: (task: Task) => number | null | undefined
  onToggle: (task: Task) => void
  className?: string
}

/** « ▸ Terminées (n) » : replié par défaut, comme dans la maquette. */
export function DoneSection({
  tasks,
  objectiveSlotOf,
  onToggle,
  className,
}: DoneSectionProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  if (tasks.length === 0) return null

  return (
    <div className={className}>
      <div className="mt-4 mb-1 h-px bg-border" />

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-fit cursor-pointer items-center gap-1.5 rounded-xs p-0.5 text-body font-medium text-ink-faint',
          'transition-colors duration-150 hover:text-ink-2',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        )}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        Terminées ({tasks.length})
      </button>

      {open && (
        <ul
          id={panelId}
          className="mt-1 flex flex-col"
        >
          {tasks.map((task) => {
            const slot = objectiveSlotOf(task)
            return (
              <li key={task.id} className="flex items-center gap-[13px] px-1 py-3">
                <TaskCheckbox
                  done
                  title={task.title}
                  accent={slot != null ? objectiveSkin(slot).core : null}
                  onToggle={() => onToggle(task)}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted line-through">
                  {task.title}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
