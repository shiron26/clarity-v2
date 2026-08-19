// Le conteneur de glissement, partagé par les trois surfaces du produit.
//
// Une surface = un conteneur. Deux rendus de la MÊME liste (la version desktop
// et la version mobile de l'écran Tâches) = deux conteneurs : deux éléments
// déplaçables ne peuvent pas porter le même identifiant dans un seul contexte.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  closestCorners,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  type SortingStrategy,
} from '@dnd-kit/sortable'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { createAnnouncements, dndInstructions } from './dndAccessibility'
import { useDndSensors } from './dndSensors'

export type SortableLayout = 'list' | 'grid'

type SortableContainerProps = {
  /** Ordre affiché, tel que la source de vérité le produit. */
  ids: string[]
  labelOf: (id: string) => string
  onReorder: (orderedIds: string[]) => void
  /** Pas de tri manuel, pas de mode Organiser : rien ne se saisit. */
  disabled?: boolean
  layout?: SortableLayout
  /** Ce qui suit le pointeur. Rendu dans un portail vers `document.body`. */
  renderOverlay: (id: string) => ReactNode
  /** Reçoit l'ordre à afficher : identique à `ids` hors glissement. */
  children: (orderedIds: string[]) => ReactNode
}

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

// Une stratégie qui ne calcule aucun aperçu. La grille de l'accueil se réagence
// pour de vrai pendant le geste (voir plus bas), le moteur de grille fait donc
// déjà tout le travail : superposer des transforms le referait deux fois.
const noPreview: SortingStrategy = () => null

/**
 * Détection de collision de la grille.
 *
 * Au clavier il n'y a pas de coordonnées de pointeur : la cible se déduit des
 * seuls rectangles, et celui de la carte déplacée l'emporte sur ceux de ses
 * voisines dès qu'elle est plus étroite qu'elles. Un widget d'un tiers restait
 * ainsi collé à sa case, les flèches n'en sortaient jamais. L'écarter de la
 * comparaison lève le blocage, et seulement là où le problème existe : à la
 * souris, les rectangles se comparent depuis une position réelle et la carte
 * déplacée doit rester candidate, sinon la grille se réagence dès le premier
 * pixel.
 */
const gridCollision: CollisionDetection = (args) =>
  closestCorners({
    ...args,
    droppableContainers: args.pointerCoordinates
      ? args.droppableContainers
      : args.droppableContainers.filter((container) => container.id !== args.active.id),
  })

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    // Sans ça, `isDragging` repasse à faux au dépôt : la ligne d'origine
    // retrouve son opacité pleine pendant que la copie vole encore vers elle, et
    // l'on voit brièvement deux fois le même élément.
    styles: { active: { opacity: '0.35' } },
  }),
}

export function SortableContainer({
  ids,
  labelOf,
  onReorder,
  disabled = false,
  layout = 'list',
  renderOverlay,
  children,
}: SortableContainerProps) {
  const reducedMotion = usePrefersReducedMotion()
  const sensors = useDndSensors()

  // Ordre local, le temps que la source de vérité rattrape. Il ne sert pas à
  // afficher le geste (dnd-kit s'en charge) mais à couvrir le décalage entre le
  // dépôt et l'arrivée de l'optimistic update : sans lui, la copie s'anime vers
  // une position que la liste n'a pas encore prise, et la ligne fait un
  // aller-retour visible.
  const [pending, setPending] = useState<string[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Rang où l'élément se poserait, tenu à jour par les gestionnaires ci-dessous
  // et lu par les annonces. Il ne se déduit pas de l'ordre affiché : la grille
  // s'est déjà réagencée quand la liste, elle, ne bouge qu'au dépôt.
  const rankRef = useRef(0)

  const order = pending ?? ids
  const orderRef = useRef(order)
  orderRef.current = order

  useEffect(() => {
    if (pending && sameOrder(pending, ids)) setPending(null)
  }, [pending, ids])

  const announcements = useMemo(
    () =>
      createAnnouncements({
        labelOf,
        // En liste, l'ordre affiché ne bouge pas tant que le geste dure : seule
        // la cible dit où l'élément atterrirait. En grille, la disposition s'est
        // déjà réagencée, et c'est donc l'élément lui-même qu'il faut situer.
        rankOf: () => rankRef.current,
        countOf: () => orderRef.current.length,
      }),
    [labelOf],
  )

  const onDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    rankRef.current = orderRef.current.indexOf(id) + 1
    setActiveId(id)
  }, [])

  // Réagencement RÉEL, et seulement en grille. `rectSortingStrategy` permute des
  // rectangles en les supposant de même taille : avec des cellules d'un tiers,
  // de deux tiers et pleine largeur, elle pose les cartes sur l'empreinte de
  // leurs voisines et elles se chevauchent. Laisser le moteur de grille
  // recalculer la vraie géométrie est la seule façon d'être juste.
  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over || over.id === active.id) return
      const current = orderRef.current
      const from = current.indexOf(String(active.id))
      const to = current.indexOf(String(over.id))
      // Garde-fou contre l'oscillation : réagencer sous le curseur peut ramener
      // la cible sous le curseur, et deux positions se mettraient à clignoter.
      if (from < 0 || to < 0 || from === to) return
      rankRef.current = to + 1
      if (layout === 'grid') setPending(arrayMove(current, from, to))
    },
    [layout],
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      const current = orderRef.current

      if (layout === 'grid') {
        // La grille s'est déjà réagencée pendant le geste : il ne reste qu'à
        // publier, si tant est que quelque chose ait bougé.
        rankRef.current = current.indexOf(String(active.id)) + 1
        if (!sameOrder(current, ids)) onReorder(current)
        return
      }

      if (!over || over.id === active.id) return
      const from = current.indexOf(String(active.id))
      const to = current.indexOf(String(over.id))
      if (from < 0 || to < 0 || from === to) return
      rankRef.current = to + 1
      const next = arrayMove(current, from, to)
      setPending(next)
      onReorder(next)
    },
    [layout, ids, onReorder],
  )

  // Échap annule le déplacement, mais dnd-kit écoute `document` en phase de
  // BULLAGE et ne s'y abonne qu'au début du geste : l'écouteur de `Modal`, posé
  // à l'ouverture de la feuille, passe donc avant lui et la refermerait avant
  // même que le déplacement soit annulé.
  //
  // Marquer l'évènement ici, en phase de CAPTURE, suffit à remettre les choses
  // dans l'ordre : `Modal` voit un évènement déjà traité et se tait, tandis que
  // dnd-kit reçoit bien sa touche (la propagation, elle, n'est pas coupée).
  useEffect(() => {
    if (!activeId) return
    function markEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') event.preventDefault()
    }
    document.addEventListener('keydown', markEscape, true)
    return () => document.removeEventListener('keydown', markEscape, true)
  }, [activeId])

  const onDragCancel = useCallback(() => {
    setActiveId(null)
    setPending(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      // `closestCenter` suffit à une pile de lignes de même largeur. La grille,
      // elle, mêle des cartes d'un tiers et des cartes pleine largeur : voir
      // `gridCollision`.
      collisionDetection={layout === 'grid' ? gridCollision : closestCenter}
      // Obligatoire en grille : sans remesure, la détection de collision
      // travaillerait sur la géométrie d'avant le premier réagencement.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ announcements, screenReaderInstructions: dndInstructions }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext
        items={order}
        disabled={disabled}
        strategy={layout === 'list' ? verticalListSortingStrategy : noPreview}
      >
        {children(order)}
      </SortableContext>

      {/* Portalisé vers `document.body`. Un calque `position: fixed` rendu dans
          le panneau d'une modale dépend de l'absence de `transform` sur ce
          panneau — garantie aujourd'hui par le seul `animation-fill-mode:
          backwards` de `src/index.css`, et déjà cassée une fois (voir le piège
          documenté sur `Popover`). Le portail rend la question sans objet.

          Les modificateurs vont ICI et non sur `DndContext` : dès qu'un overlay
          existe, c'est lui qui bouge, la source ne se déplace plus.

          Pas de classe `z-*` : le `z-index: 999` inline de dnd-kit passe déjà
          au-dessus du voile des modales et des cérémonies. */}
      {createPortal(
        <DragOverlay
          modifiers={
            layout === 'list'
              ? [restrictToVerticalAxis, restrictToWindowEdges]
              : [restrictToWindowEdges]
          }
          dropAnimation={reducedMotion ? null : dropAnimation}
          className="cursor-grabbing"
        >
          {activeId ? renderOverlay(activeId) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
