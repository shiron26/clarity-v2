import { Link } from 'react-router'
import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import type { Task } from '../../../hooks/useTasks'
import { TaskRow, type DonePhase } from './TaskRow'

type FocusTodayCardProps = {
  tasks: Task[]
  objectives: Map<string, Objective>
  lists: Map<string, List>
  onToggle: (task: Task) => void
  /**
   * L'utilisateur a-t-il déjà au moins un objectif ? Décide de la marche à
   * suivre proposée quand la journée est vide : en définir un, ou planifier
   * des tâches.
   */
  hasObjectives?: boolean
  /** Phase de sortie d'une tâche fraîchement cochée, sinon undefined. */
  donePhaseFor?: (taskId: string) => DonePhase | undefined
  reducedMotion?: boolean
}

export function FocusTodayCard({
  tasks,
  objectives,
  lists,
  onToggle,
  hasObjectives = false,
  donePhaseFor,
  reducedMotion,
}: FocusTodayCardProps) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-card font-semibold">Focus du jour</h2>
        <Link
          to="/taches"
          className="text-label font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Tout voir →
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-9 text-center">
          <p className="text-body font-medium text-ink-2">Aucune tâche pour aujourd’hui</p>
          <p className="max-w-[280px] text-label leading-relaxed text-ink-muted">
            {hasObjectives
              ? 'Planifiez une tâche pour aujourd’hui et reliez-la à un objectif.'
              : 'Créez d’abord un objectif, puis reliez-y vos premières tâches.'}
          </p>
          {/* Avec des objectifs, « Tout voir » en tête de carte mène déjà aux
              tâches : un second lien ferait doublon. */}
          {!hasObjectives && (
            <Link
              to="/objectifs"
              className="mt-1.5 text-label font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              Définir mes objectifs →
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              objectiveSlot={
                task.objective_id ? objectives.get(task.objective_id)?.slot : undefined
              }
              list={task.list_id ? lists.get(task.list_id) : undefined}
              onToggle={onToggle}
              last={i === tasks.length - 1}
              donePhase={donePhaseFor?.(task.id)}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      )}
    </section>
  )
}
