// Réordonnancement manuel des tâches. La maquette suit le pointeur et lit la
// ligne survolée avec `document.elementFromPoint` : on garde ce principe, et on
// lui ajoute le chemin clavier qu'elle n'a pas.
//
// L'ordre affiché est local tant que le glissement dure ; il n'est envoyé au
// serveur qu'au dépôt, en une seule mutation.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type UseTaskDragOptions = {
  /** Ordre affiché des identifiants, tel que le tri courant le produit. */
  ids: string[]
  /** Le glissement n'existe qu'en tri manuel. */
  enabled: boolean
  onCommit: (orderedIds: string[]) => void
  /** Titre d'une tâche, pour l'annonce vocale. */
  titleOf: (id: string) => string
}

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function moved(order: string[], id: string, targetIndex: number) {
  const from = order.indexOf(id)
  if (from < 0 || targetIndex < 0 || targetIndex >= order.length || from === targetIndex) return null
  const next = [...order]
  next.splice(from, 1)
  next.splice(targetIndex, 0, id)
  return next
}

export function useTaskDrag({ ids, enabled, onCommit, titleOf }: UseTaskDragOptions) {
  const [override, setOverride] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const order = override ?? ids

  // Les écouteurs de fenêtre ne se réabonnent pas à chaque déplacement : ils
  // lisent l'état courant dans des refs.
  const orderRef = useRef(order)
  orderRef.current = order
  const dragIdRef = useRef(dragId)
  dragIdRef.current = dragId

  // L'ordre local s'efface dès que le serveur (ou l'optimistic update) l'a
  // rattrapé : sans ça, une ligne rendue plus tard resterait figée.
  useEffect(() => {
    if (override && sameOrder(override, ids)) setOverride(null)
  }, [override, ids])

  // `onCommit` est recréé à chaque rendu par l'appelant : sans cette ref, les
  // écouteurs de fenêtre se réabonneraient à chaque rendu de la liste.
  const commitRef = useRef<() => void>(() => {})
  commitRef.current = () => {
    const next = orderRef.current
    if (!sameOrder(next, ids)) onCommit(next)
  }
  const commit = useCallback(() => commitRef.current(), [])

  useEffect(() => {
    if (!enabled) return

    function onPointerMove(event: globalThis.PointerEvent) {
      const dragging = dragIdRef.current
      if (!dragging) return
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const row = element?.closest('[data-task-row]')
      const overId = row?.getAttribute('data-task-row')
      if (!overId || overId === dragging) return
      const next = moved(orderRef.current, dragging, orderRef.current.indexOf(overId))
      if (next) setOverride(next)
    }

    function onPointerUp() {
      if (!dragIdRef.current) return
      setDragId(null)
      commit()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [enabled, commit])

  const onGripPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, task: { id: string }) => {
      if (!enabled) return
      event.preventDefault()
      setDragId(task.id)
    },
    [enabled],
  )

  const announce = useCallback(
    (id: string, next: string[]) => {
      setAnnouncement(
        `${titleOf(id)}, position ${next.indexOf(id) + 1} sur ${next.length}`,
      )
    },
    [titleOf],
  )

  const onGripKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, task: { id: string }) => {
      if (!enabled) return
      const id = task.id

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (grabbedId === id) {
          setGrabbedId(null)
          commit()
          setAnnouncement(`${titleOf(id)} déposée.`)
        } else {
          setGrabbedId(id)
          setAnnouncement(
            `${titleOf(id)} saisie. Flèches haut et bas pour déplacer, Entrée pour déposer.`,
          )
        }
        return
      }

      if (event.key === 'Escape' && grabbedId === id) {
        event.preventDefault()
        setGrabbedId(null)
        setOverride(null)
        setAnnouncement('Déplacement annulé.')
        return
      }

      if (grabbedId !== id) return

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const delta = event.key === 'ArrowUp' ? -1 : 1
        const next = moved(orderRef.current, id, orderRef.current.indexOf(id) + delta)
        if (next) {
          setOverride(next)
          announce(id, next)
        }
      }
    },
    [enabled, grabbedId, commit, titleOf, announce],
  )

  return { order, dragId, grabbedId, announcement, onGripPointerDown, onGripKeyDown }
}
