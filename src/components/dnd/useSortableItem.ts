// Le SEUL appelant de `useSortable` du dépôt. Tout ce qui suit y est concentré
// pour n'exister qu'une fois : la description de rôle en français, le style
// inline encadré, et le respect du mouvement réduit.
//
// Un composant rendu HORS d'un `DndContext` (`TaskListRow` dans la section « en
// retard ») ne doit jamais appeler ce hook : une enveloppe `Sortable*` l'isole.
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'

// Dérivé du retour du hook plutôt qu'importé : `SyntheticListenerMap` n'est pas
// exporté depuis la racine de `@dnd-kit/core`, et un import profond casserait à
// la première montée de version.
type SortableResult = ReturnType<typeof useSortable>

/**
 * Ce qu'il faut poser sur la poignée. Les trois morceaux restent séparés parce
 * que les écouteurs de dnd-kit sont typés par une signature d'index de
 * fonctions : les fondre avec les attributs ARIA rendrait l'ensemble
 * inexprimable.
 */
export type DragHandleProps = {
  attributes: SortableResult['attributes']
  listeners: SortableResult['listeners']
  /** Désigne l'élément qui déclenche le geste, distinct de l'élément déplacé. */
  ref: SortableResult['setActivatorNodeRef']
}

type UseSortableItemOptions = {
  id: string
  disabled?: boolean
  /** Lu à la place de « sortable » : « tâche déplaçable », « widget déplaçable ». */
  roleDescription: string
  reducedMotion?: boolean
  /**
   * Anime la cellule quand la disposition change PENDANT le geste. Réservé à la
   * grille de l'accueil, qui se réagence pour de vrai : ailleurs, dnd-kit calcule
   * lui-même l'aperçu et cette option ferait doublon.
   */
  animateLayout?: boolean
}

export type SortableItem = {
  setNodeRef: (node: HTMLElement | null) => void
  /**
   * Transform et transition calculés par dnd-kit. C'est, avec les couleurs
   * venant de la base, la seule exception au « pas de style inline » : une
   * valeur recalculée à chaque image d'animation ne peut pas être une classe.
   * Un composant le reçoit en objet opaque et le fusionne, il ne l'écrit jamais.
   */
  style: CSSProperties
  handleProps: DragHandleProps
  isDragging: boolean
}

// `defaultAnimateLayoutChanges` exige `wasDragging`, donc n'anime qu'APRÈS le
// dépôt. La grille, elle, change de disposition pendant le geste : sans ce
// forçage les widgets se téléportent d'une case à l'autre au lieu de glisser.
const animateDuringDrag = (args: Parameters<typeof defaultAnimateLayoutChanges>[0]) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true })

export function useSortableItem({
  id,
  disabled,
  roleDescription,
  reducedMotion = false,
  animateLayout = false,
}: UseSortableItemOptions): SortableItem {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
    attributes: { roleDescription },
    transition: reducedMotion ? null : undefined,
    ...(animateLayout ? { animateLayoutChanges: animateDuringDrag } : {}),
  })

  return {
    setNodeRef,
    style: {
      // `Translate` et non `Transform` : ce dernier ajoute `scaleX`/`scaleY`, qui
      // étire le contenu dès que deux éléments n'ont pas la même taille — la
      // grille de l'accueil, précisément. Une translation suffit à faire glisser.
      //
      // Au repos `transform` vaut `null` et `toString` rend `undefined` : React
      // n'écrit alors AUCUN `transform` dans le DOM. C'est indispensable, sinon
      // chaque ligne deviendrait le bloc conteneur des descendants `fixed` de son
      // propre `Popover` (même piège que celui documenté dans `src/index.css`).
      transform: CSS.Translate.toString(transform),
      transition: transition ?? undefined,
    },
    handleProps: { attributes, listeners, ref: setActivatorNodeRef },
    isDragging,
  }
}
