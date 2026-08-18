import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import type { Task } from '../../../hooks/useTasks'
import type { DonePhase } from '../../../components/tasks/TaskRow'
import { TaskRowList } from '../../../components/tasks/TaskRowList'

type OverdueCardProps = {
  tasks: Task[]
  objectives: Map<string, Objective>
  lists: Map<string, List>
  onToggle: (task: Task) => void
  onToggleImportant: (task: Task) => void
  donePhaseFor?: (taskId: string) => DonePhase | undefined
  reducedMotion?: boolean
}

// Les tâches en retard vivent dans une section distincte de « Aujourd'hui »
// (SPEC §5) — jamais mélangées à la liste du jour, mais posées à côté d'elle sur
// la même ligne en desktop.
//
// D'où la même coquille que `TodayBlock` (fond blanc, ombre de carte, titre au
// même corps) : côte à côte, une carte bordée face à une carte ombrée se lisait
// comme un oubli. Ce qui distingue le bloc, c'est son titre rouge et le compte
// entre parenthèses, pas son cadre.
export function OverdueCard({
  tasks,
  objectives,
  lists,
  onToggle,
  onToggleImportant,
  donePhaseFor,
  reducedMotion,
}: OverdueCardProps) {
  if (tasks.length === 0) return null

  return (
    <section className="min-w-0 rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="mb-1.5 text-card font-semibold text-danger">
        En retard ({tasks.length})
      </h2>
      <TaskRowList
        tasks={tasks}
        objectives={objectives}
        lists={lists}
        onToggle={onToggle}
        onToggleImportant={onToggleImportant}
        showDueDate
        donePhaseFor={donePhaseFor}
        reducedMotion={reducedMotion}
      />
    </section>
  )
}
