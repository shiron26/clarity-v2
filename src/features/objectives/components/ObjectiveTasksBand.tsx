import { Alert } from '../../../components/ui/Alert'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { useToggleTask } from '../../../hooks/useToggleTask'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import { formatOverdueDelay, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import type { Objective } from '../../../hooks/useObjectives'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'

/** Au-delà, la bande devient une liste : l'écran Tâches est fait pour ça. */
const MAX_ROWS = 5

type ObjectiveTasksBandProps = {
  objective: Objective
  today: IsoDate
  readOnly?: boolean
}

/**
 * Bande 4 — **la matière**.
 *
 * Les tâches ouvertes rattachées à l'objectif, cochables sur place. Elle ne
 * paraît que là où le bloc de rythme est absent : ailleurs, la grille de densité
 * dit déjà ce que les tâches ont produit, et les répéter allongerait l'écran
 * sans rien ajouter.
 *
 * L'âge est une **information, pas un reproche** : « depuis 6 semaines » en méta
 * discrète, jamais en rouge (REFONTE §5).
 */
export function ObjectiveTasksBand({ objective, today, readOnly = false }: ObjectiveTasksBandProps) {
  const tasksQuery = useTasks('objective', { objectiveId: objective.id })
  const toggleTask = useToggleTask()
  const skin = objectiveSkinOf(objective)

  const open = (tasksQuery.data ?? []).filter((t) => t.completed_at === null)
  const rows = open.slice(0, MAX_ROWS)
  const hidden = open.length - rows.length

  if (tasksQuery.isPending) return null
  if (!tasksQuery.error && open.length === 0) return null

  return (
    <section className="border-t border-surface-subtle px-5.5 py-4">
      <h3 className={cn(SECTION_LABEL, 'mb-1')}>
        Tâches reliées
      </h3>

      {tasksQuery.error ? (
        <Alert>{dataErrorMessage(tasksQuery.error)}</Alert>
      ) : (
        <>
          <ul className="flex flex-col">
            {rows.map((task) => (
              <TaskLine
                key={task.id}
                task={task}
                today={today}
                accent={skin.core}
                readOnly={readOnly}
                onToggle={() => toggleTask.mutate({ id: task.id, completed: true })}
              />
            ))}
          </ul>
          {hidden > 0 && (
            <p className="mt-2 text-caption text-ink-muted">
              et {hidden} autre{hidden > 1 ? 's' : ''}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function TaskLine({
  task,
  today,
  accent,
  readOnly,
  onToggle,
}: {
  task: Task
  today: IsoDate
  accent: string
  readOnly: boolean
  onToggle: () => void
}) {
  return (
    <li className="flex items-center gap-3 border-b border-surface-subtle py-2.5 last:border-b-0">
      <TaskCheckbox
        done={false}
        title={task.title}
        onToggle={readOnly ? () => {} : onToggle}
        accent={accent}
        compact
      />
      <span className={cn('min-w-0 flex-1 truncate text-body text-ink-2')}>{task.title}</span>
      {task.due_date && (
        <span className="shrink-0 text-caption text-ink-muted">
          {formatOverdueDelay(task.due_date, today)}
        </span>
      )}
    </li>
  )
}
