import type { ReactNode } from 'react'
import { useSortableItem, type DragHandleProps } from '../../../components/dnd/useSortableItem'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { cn } from '../../../lib/cn'
import type { WidgetSpan } from '../dashboardLayout'

// Classes littérales : Tailwind v4 lit les sources, une classe composée à la
// volée ne serait pas générée.
const SPAN_CLASS: Record<WidgetSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
}

/**
 * Une cellule de la grille de l'accueil, branchée sur le glissement.
 *
 * `animateLayout` est vrai ici et nulle part ailleurs : la grille se réagence
 * pour de vrai pendant le geste, et sans lui les widgets se téléporteraient
 * d'une case à l'autre au lieu de glisser.
 */
export function SortableWidgetCell({
  widgetKey,
  span,
  editing,
  children,
}: {
  widgetKey: string
  span: WidgetSpan
  editing: boolean
  children: (cell: { isDragging: boolean; handleProps: DragHandleProps }) => ReactNode
}) {
  const reducedMotion = usePrefersReducedMotion()
  // Appelé inconditionnellement (règle des hooks) : hors mode Organiser,
  // `disabled` suffit à rendre le style vide et la cellule inerte.
  const { setNodeRef, style, handleProps, isDragging } = useSortableItem({
    id: widgetKey,
    disabled: !editing,
    roleDescription: 'widget déplaçable',
    reducedMotion,
    animateLayout: true,
  })

  return (
    <div ref={setNodeRef} style={style} className={cn('min-w-0', SPAN_CLASS[span])}>
      {children({ isDragging, handleProps })}
    </div>
  )
}
