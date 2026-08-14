// Séquence de sortie d'une tâche cochée, telle que la joue la maquette : la ligne
// flashe, se replie, puis quitte la liste, pendant que la carte de l'objectif lié
// se rallume. Le dashboard et l'écran Tâches la jouent à l'identique — d'où ce
// hook plutôt qu'une recopie du chronométrage dans chaque écran.
import { useCallback, useEffect, useRef, useState } from 'react'
import { DONE_CLEAR_MS, DONE_FLASH_MS, type DonePhase } from '../components/tasks/taskDone'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

/** Le strict minimum dont la séquence a besoin d'une tâche. */
type Completable = { id: string; objective_id: string | null }

export function useDoneSequence() {
  const reducedMotion = usePrefersReducedMotion()
  const [justDone, setJustDone] = useState<Map<string, DonePhase>>(new Map())
  const [poppingObjectiveId, setPoppingObjectiveId] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const clearDone = useCallback((taskId: string) => {
    setJustDone((prev) => {
      if (!prev.has(taskId)) return prev
      const next = new Map(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  const startDoneSequence = useCallback(
    (task: Completable) => {
      // Mouvement réduit : la tâche disparaît sans flash ni repli.
      if (reducedMotion) return
      setJustDone((prev) => new Map(prev).set(task.id, 1))
      if (task.objective_id) setPoppingObjectiveId(task.objective_id)

      timers.current.push(
        window.setTimeout(
          () => setJustDone((prev) => (prev.has(task.id) ? new Map(prev).set(task.id, 2) : prev)),
          DONE_FLASH_MS,
        ),
        window.setTimeout(() => {
          clearDone(task.id)
          setPoppingObjectiveId(null)
        }, DONE_CLEAR_MS),
      )
    },
    [reducedMotion, clearDone],
  )

  const donePhaseFor = useCallback((taskId: string) => justDone.get(taskId), [justDone])

  /** Une tâche cochée reste affichée le temps de son animation, puis sort. */
  const isVisible = useCallback(
    (task: { id: string; completed_at: string | null }) =>
      task.completed_at === null || justDone.has(task.id),
    [justDone],
  )

  return {
    justDone,
    poppingObjectiveId,
    startDoneSequence,
    clearDone,
    donePhaseFor,
    isVisible,
    reducedMotion,
  }
}
