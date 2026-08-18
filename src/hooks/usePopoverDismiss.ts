import { useEffect, type RefObject } from 'react'

type PopoverDismissOptions = {
  open: boolean
  onClose: () => void
  /**
   * Panneau flottant : un clic à l'intérieur ne ferme pas. **Il doit désigner la
   * boîte du calque**, pas un conteneur en `display: contents` — la garde
   * ci-dessous lit ses rectangles, et un tel conteneur n'en a aucun.
   */
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
 *
 * Un calque **masqué par CSS ne ferme rien** : voir la garde du gestionnaire.
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
      const panel = panelRef.current

      // Un calque que le CSS n'affiche pas n'a rien à fermer.
      //
      // Deux rendus d'un même contrôle (variante repliable `sm:hidden` en mobile,
      // calque `hidden sm:flex` en desktop) partagent en général un seul booléen
      // d'ouverture. React monte alors les DEUX : `display:none` n'empêche ni le
      // montage ni les effets. Sans cette garde, le calque invisible fermait
      // l'état commun dès le `pointerdown` reçu dans la variante VISIBLE, qui
      // n'est ni son panneau ni son déclencheur — le calendrier mobile était
      // démonté avant le `click`, et choisir un jour ne faisait rien.
      //
      // Le test vit dans le gestionnaire, jamais au montage de l'effet : franchir
      // une largeur de rupture est un changement purement CSS, aucun rendu React
      // ne l'annonce, une garde évaluée à l'attachement serait périmée au premier
      // redimensionnement.
      //
      // `getClientRects()` et non `offsetParent` : ce dernier vaut `null` pour
      // tout élément `position: fixed` (CSSOM View), ce qu'est justement
      // `Popover` — la garde aurait supprimé la fermeture au clic extérieur
      // partout, sans rien casser de visible. Un panneau seulement en
      // `visibility: hidden` garde ses rectangles, donc la première image non
      // encore mesurée d'un `Popover` reste, elle, refermable.
      if (!panel || panel.getClientRects().length === 0) return

      const target = event.target as Node
      if (panel.contains(target)) return
      if (triggerRef?.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose, panelRef, triggerRef])
}
