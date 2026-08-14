import { useEffect, type RefObject } from 'react'

type PopoverDismissOptions = {
  open: boolean
  onClose: () => void
  /** Panneau flottant : un clic à l'intérieur ne ferme pas. */
  panelRef: RefObject<HTMLElement | null>
  /** Déclencheur : un clic dessus est son propre bascule, pas une fermeture. */
  triggerRef?: RefObject<HTMLElement | null>
}

/**
 * Fermeture d'un calque flottant sur un clic extérieur. C'est la seule partie de
 * `Menu` qui ne parle pas de menus — `Popover` la réutilise telle quelle.
 *
 * Volontairement, ce hook **ne gère pas Échap** : l'écouteur devrait vivre sur
 * `document`, or `Modal` y pose déjà le sien et le nôtre passerait après (la modale
 * se fermerait à la place du popover). Chaque calque traite donc Échap sur son
 * propre `onKeyDown` React, avec `stopPropagation()`.
 */
export function usePopoverDismiss({
  open,
  onClose,
  panelRef,
  triggerRef,
}: PopoverDismissOptions) {
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (triggerRef?.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose, panelRef, triggerRef])
}
