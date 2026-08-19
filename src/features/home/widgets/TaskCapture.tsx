import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/useAuth'
import { useCreateTask } from '../../../hooks/useTaskMutations'
import { nextTaskPosition } from '../../tasks/nextTaskPosition'
import { Input } from '../../../components/ui/Input'
import { Alert } from '../../../components/ui/Alert'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { cn } from '../../../lib/cn'

/**
 * La capture en une ligne : un champ, Entrée, c'est écrit.
 *
 * Ni date, ni objectif, ni liste imposée — c'est le comportement observé chez
 * les testeurs : on note, on range plus tard. La modale complète reste là pour
 * ce qui a vraiment une échéance.
 */
type TaskCaptureProps = {
  placeholder: string
  /** Liste d'accueil, ou `null` pour le tas des tâches sans liste. */
  listId: string | null
  className?: string
}

export function TaskCapture({ placeholder, listId, className }: TaskCaptureProps) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const createTask = useCreateTask()
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = title.trim()
    const userId = session?.user.id
    if (!value || !userId || createTask.isPending) return

    createTask.mutate(
      {
        userId,
        title: value,
        description: null,
        dueDate: null,
        objectiveId: null,
        listId,
        isImportant: false,
        recurrence: null,
        // Sans position explicite, le trigger fait naître la tâche en tête.
        position: nextTaskPosition(queryClient),
      },
      // Le champ ne se vide qu'une fois la ligne acceptée : en cas d'échec, ce
      // qu'on vient d'écrire est toujours là.
      { onSuccess: () => setTitle('') },
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('mt-2', className)}>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="py-2.5 text-body"
      />
      {createTask.error && (
        <Alert className="mt-2">{dataErrorMessage(createTask.error)}</Alert>
      )}
    </form>
  )
}
