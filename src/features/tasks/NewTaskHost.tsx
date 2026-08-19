import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useAppToday } from '../../hooks/useAppToday'
import { useHotkey } from '../../hooks/useHotkey'
import { selectTaskLists, useLists } from '../../hooks/useLists'
import { useNewTask } from '../../hooks/useNewTask'
import { selectPrincipals, useObjectives } from '../../hooks/useObjectives'
import { year as yearOf } from '../../lib/appDate'
import { TaskFormModal } from './components/TaskFormModal'
import { nextTaskPosition } from './nextTaskPosition'
import { parseTaskParams } from './taskViewParams'

/**
 * Propriétaire de la modale « Nouvelle tâche », monté une seule fois dans
 * `AppShell` — donc disponible sur les quatre écrans authentifiés.
 *
 * Elle vivait dans l'écran Tâches, ce qui obligeait le raccourci à naviguer vers
 * `/taches` pour l'ouvrir. Ici, `N` se contente d'ajouter `?nouvelle=1` à la route
 * COURANTE : la modale s'ouvre par-dessus l'écran où l'on est, et le referme y
 * laisse. C'est de la capture rapide — on ne perd jamais son contexte.
 *
 * L'état reste dans l'URL, comme avant : c'est ce qui permet au bouton du header
 * Tâches, aux CTA de l'état vide et au bouton flottant mobile de l'ouvrir sans
 * qu'aucun contexte partagé n'existe entre eux.
 */
export function NewTaskHost() {
  const { open, openNewTask, closeNewTask } = useNewTask()

  useHotkey('n', openNewTask)

  if (!open) return null
  return <NewTaskModal onClose={closeNewTask} />
}

/**
 * Monté seulement quand la modale est ouverte : les queries ne tournent pas sur le
 * chemin de rendu normal. Aucune n'est nouvelle pour autant — `app_today` et les
 * listes sont déjà chargés par la `Sidebar` sur toutes les routes, et les objectifs
 * de l'année par chacune des pages.
 */
function NewTaskModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { scope, listId } = parseTaskParams(searchParams)

  const todayQuery = useAppToday()
  const today = todayQuery.data
  const objectivesQuery = useObjectives(today ? yearOf(today) : undefined)
  const listsQuery = useLists()

  const principals = useMemo(() => selectPrincipals(objectivesQuery.data), [objectivesQuery.data])

  // La date du serveur est l'ancre de tout le formulaire (échéance par défaut,
  // récurrence) : sans elle il n'y a rien à afficher. Une coquille avec un spinner
  // plutôt que `null`, sinon le raccourci paraîtrait ne rien faire.
  if (!today) {
    return (
      <Modal open onClose={onClose} title="Nouvelle tâche" variant="sheet" className="sm:w-[620px]">
        <div className="flex min-h-24 items-center justify-center">
          <Spinner className="text-ink-muted" />
        </div>
      </Modal>
    )
  }

  return (
    <TaskFormModal
      open
      onClose={onClose}
      principals={principals}
      // Jamais un aide-mémoire : on n'y range pas une tâche datée.
      lists={selectTaskLists(listsQuery.data)}
      today={today}
      // Hors de l'écran Tâches il n'y a pas de `?liste=` : la tâche naît sans liste.
      defaultListId={listId}
      // Depuis le pool, la tâche naît sans échéance — sinon elle disparaîtrait
      // de la vue où on vient de l'écrire.
      defaultDueDate={scope === 'undated' ? null : today}
      nextPosition={nextTaskPosition(queryClient)}
    />
  )
}
