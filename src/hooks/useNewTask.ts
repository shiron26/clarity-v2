import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

const NEW_TASK_PARAM = 'nouvelle'

/**
 * Ouverture de la modale « Nouvelle tâche ».
 *
 * Transverse par nature : le dashboard, la barre d'onglets mobile et l'écran Tâches
 * l'ouvrent tous, et `NewTaskHost` la rend — aucun n'a à connaître les autres.
 * C'est ce qui lui vaut de vivre ici plutôt que dans `features/tasks/` : une feature
 * n'importe jamais depuis une autre.
 *
 * L'état vit dans l'URL, comme le reste de l'adressage de l'app : la modale est
 * partageable et le bouton « précédent » la referme.
 */
export function useNewTask() {
  const [searchParams, setSearchParams] = useSearchParams()

  const openNewTask = useCallback(() => {
    // Pas de navigation : on pose le paramètre sur la route COURANTE, la modale
    // s'ouvre par-dessus l'écran où l'on est.
    const next = new URLSearchParams(searchParams)
    next.set(NEW_TASK_PARAM, '1')
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  const closeNewTask = useCallback(() => {
    // Fermer une modale n'est pas une navigation : pas d'entrée d'historique.
    const next = new URLSearchParams(searchParams)
    next.delete(NEW_TASK_PARAM)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return { open: searchParams.get(NEW_TASK_PARAM) === '1', openNewTask, closeNewTask }
}
