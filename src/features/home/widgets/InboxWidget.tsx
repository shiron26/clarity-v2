import { useMemo } from 'react'
import { Link } from 'react-router'
import { useAppDayStart } from '../../../hooks/useAppToday'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { selectTaskLists, useLists } from '../../../hooks/useLists'
import { useUpdateTask } from '../../../hooks/useTaskMutations'
import { taskAge } from '../../../lib/taskAge'
import { InboxRow } from './InboxRow'
import { WIDGET_GLYPH } from './glyphs'
import { useDashboardCtx } from '../dashboardContext'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { TaskCapture } from './TaskCapture'

const SHOWN = 5

/**
 * « À trier » — les tâches sans date et sans liste, avec le champ de capture.
 *
 * Le tas existe déjà (vue « Sans date » de l'écran Tâches) mais il est invisible
 * depuis l'accueil, et un endroit où l'on jette sans jamais y retourner finit
 * par ne plus rien vouloir dire. Le montrer est la seule façon de le tenir bas.
 *
 * Et le montrer ne suffit pas : chaque ligne porte de quoi lui donner une liste
 * ou une date, sans quoi trier voudrait dire ouvrir un autre écran. Le geste fait
 * sortir la ligne du widget — c'est exactement ce qu'on lui demande.
 */
export function InboxWidget() {
  const { today, onToggleTask, isVisible } = useDashboardCtx()

  const dayStartQuery = useAppDayStart()
  const listsQuery = useLists()
  const updateTask = useUpdateTask()
  // Mêmes arguments que l'écran Tâches : même query key, même cache, aucune
  // requête de plus en passant de l'un à l'autre.
  const tasksQuery = useTasks('all', { completedSince: dayStartQuery.data })

  const pool = useMemo(
    () =>
      (tasksQuery.data ?? []).filter(
        (task: Task) =>
          task.due_date === null &&
          task.list_id === null &&
          task.space_id === null &&
          task.completed_at === null,
      ),
    [tasksQuery.data],
  )
  const shown = useMemo(() => pool.filter(isVisible).slice(0, SHOWN), [pool, isVisible])
  const oldest = shown.length > 0 ? taskAge(shown[shown.length - 1], today) : null

  return (
    <WidgetCard
      title="À trier"
      icon={WIDGET_GLYPH['inbox']}
      meta={pool.length > 0 ? <span>{pool.length}</span> : undefined}
      action={
        pool.length > SHOWN ? (
          <Link
            to="/taches?vue=sans-date"
            className="text-label font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Tout voir →
          </Link>
        ) : undefined
      }
      error={tasksQuery.error ?? dayStartQuery.error ?? listsQuery.error}
      onRetry={() => void tasksQuery.refetch()}
      retrying={tasksQuery.isFetching}
    >
      {pool.length === 0 ? (
        <WidgetEmpty>Rien en attente de tri.</WidgetEmpty>
      ) : (
        <>
          <div className="flex flex-col">
            {shown.map((task) => (
              <InboxRow
                key={task.id}
                task={task}
                lists={selectTaskLists(listsQuery.data)}
                today={today}
                onToggle={onToggleTask}
                onPickList={(t, listId) => updateTask.mutate({ id: t.id, edits: { list_id: listId } })}
                onPickDue={(t, dueDate) => updateTask.mutate({ id: t.id, edits: { due_date: dueDate } })}
              />
            ))}
          </div>
          {oldest && (
            <p className="mt-1.5 text-caption text-ink-muted">
              La plus ancienne attend {oldest.long.replace('depuis ', '')}.
            </p>
          )}
        </>
      )}

      <TaskCapture placeholder="Noter une idée" listId={null} className="mt-auto pt-2" />
    </WidgetCard>
  )
}
