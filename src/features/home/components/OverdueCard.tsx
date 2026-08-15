import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import type { Task } from '../../../hooks/useTasks'
import { TaskRow, type DonePhase } from './TaskRow'

type OverdueCardProps = {
  tasks: Task[]
  objectives: Map<string, Objective>
  lists: Map<string, List>
  onToggle: (task: Task) => void
  donePhaseFor?: (taskId: string) => DonePhase | undefined
  reducedMotion?: boolean
}

// Les tâches en retard vivent dans une section distincte de « Aujourd'hui »
// (SPEC §5) — jamais mélangées à la liste du jour.
export function OverdueCard({
  tasks,
  objectives,
  lists,
  onToggle,
  donePhaseFor,
  reducedMotion,
}: OverdueCardProps) {
  if (tasks.length === 0) return null

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
      <h2 className="mb-1.5 text-body font-semibold tracking-[1.2px] text-danger">
        EN RETARD ({tasks.length})
      </h2>
      <div className="flex flex-col">
        {tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            objectiveSlot={task.objective_id ? objectives.get(task.objective_id)?.slot : undefined}
            list={task.list_id ? lists.get(task.list_id) : undefined}
            onToggle={onToggle}
            showDueDate
            last={i === tasks.length - 1}
            donePhase={donePhaseFor?.(task.id)}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </section>
  )
}
