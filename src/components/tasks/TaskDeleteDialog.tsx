import { useEffect, useRef } from 'react'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useDeleteTask, useSkipTaskOccurrence } from '../../hooks/useTaskMutations'
import type { Task } from '../../hooks/useTasks'
import { cn } from '../../lib/cn'
import { dataErrorMessage } from '../../lib/errorMessage'
import {
  TASK_DELETE_TITLE,
  TASK_SERIES_HELP,
  TASK_SERIES_LABEL,
  TASK_SKIP_HELP,
  TASK_SKIP_LABEL,
  taskRepeatIntro,
} from './taskDeleteCopy'

type TaskDeleteDialogProps = {
  /** La tâche à supprimer, ou `null` quand la boîte est fermée. */
  task: Task | null
  onClose: () => void
  /** `ceremony` au-dessus du rituel, qui occupe déjà `z-60`. */
  elevation?: 'app' | 'ceremony'
}

/**
 * Le choix qu'impose la suppression d'une tâche qui se répète : cette fois
 * seulement, ou pour de bon.
 *
 * Partagé par les trois surfaces qui suppriment une ligne (écran Tâches, rituel,
 * aide-mémoire) — d'où sa place ici et non dans une feature. La feuille
 * d'édition, elle, ne peut pas l'ouvrir : deux modales superposées écoutent
 * toutes les deux Échap. Elle porte donc le même choix dans son pied, avec la
 * copie de `taskDeleteCopy.ts`.
 *
 * Il ne s'ouvre que sur une occurrence **ouverte**. Sur une tâche déjà cochée le
 * choix n'a pas de sens : la suivante est déjà née, la supprimer n'arrête rien.
 */
export function TaskDeleteDialog({ task, onClose, elevation = 'app' }: TaskDeleteDialogProps) {
  const deleteTask = useDeleteTask()
  const skipOccurrence = useSkipTaskOccurrence()

  // La feuille met ~360 ms à redescendre : vider son contenu dès `task = null`
  // la ferait sur un panneau blanc. On garde la dernière tâche montrée.
  const shown = useRef<Task | null>(null)
  if (task) shown.current = task
  const current = task ?? shown.current

  // Un échec ne survit pas à la fermeture : rouvrir sur une autre tâche
  // afficherait sinon l'erreur de la précédente.
  const resetDelete = deleteTask.reset
  const resetSkip = skipOccurrence.reset
  useEffect(() => {
    if (task) {
      resetDelete()
      resetSkip()
    }
  }, [task, resetDelete, resetSkip])

  const pending = deleteTask.isPending || skipOccurrence.isPending
  const error = deleteTask.error ?? skipOccurrence.error

  return (
    <Modal
      open={task !== null}
      onClose={onClose}
      title={TASK_DELETE_TITLE}
      elevation={elevation}
      className="sm:w-[440px]"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
        </div>
      }
    >
      {current && (
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink-2">{taskRepeatIntro(current.recurrence)}</p>

          {error && <Alert>{dataErrorMessage(error)}</Alert>}

          {/* Deux actions, pas une sélection à confirmer : ce sont des boutons, et
              chacun porte sa conséquence en clair. Un libellé seul (« cette fois »
              / « la série ») se tranche à pile ou face. */}
          <div className="flex flex-col gap-2.5">
            <ChoiceButton
              label={TASK_SKIP_LABEL}
              help={TASK_SKIP_HELP}
              disabled={pending}
              onClick={() =>
                skipOccurrence.mutate(current.id, { onSuccess: onClose })
              }
            />
            <ChoiceButton
              label={TASK_SERIES_LABEL}
              help={TASK_SERIES_HELP}
              tone="danger"
              disabled={pending}
              onClick={() => deleteTask.mutate(current.id, { onSuccess: onClose })}
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

function ChoiceButton({
  label,
  help,
  tone = 'default',
  disabled,
  onClick,
}: {
  label: string
  help: string
  tone?: 'default' | 'danger'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'block w-full rounded-panel border-[1.5px] px-4 py-[15px] text-left',
        'transition-[background-color,border-color] duration-150',
        'focus-visible:ring-3 focus-visible:outline-none',
        'disabled:cursor-default disabled:opacity-60',
        tone === 'danger'
          ? 'border-border bg-surface hover:border-danger hover:bg-danger-bg focus-visible:ring-danger/28'
          : 'border-border bg-surface hover:border-border-primary-soft hover:bg-[#fbfcff] focus-visible:ring-primary/32',
        !disabled && 'cursor-pointer',
      )}
    >
      <span
        className={cn('block text-ui font-semibold', tone === 'danger' ? 'text-danger' : 'text-ink')}
      >
        {label}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">{help}</span>
    </button>
  )
}
