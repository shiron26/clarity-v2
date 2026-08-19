import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'

/**
 * La pastille d'un widget : son glyphe, sur un fond teinté.
 *
 * Le même objet en tête de carte et dans la palette — c'est ce qui fait qu'on
 * reconnaît au premier coup d'œil ce qu'on vient de poser. La couleur est en
 * style inline parce qu'elle vient des listes, où elle est une donnée.
 */
export function WidgetGlyph({
  icon,
  color,
  className,
}: {
  icon: ReactNode
  /** Teinte de la pastille. Grise sans elle. */
  color?: string | null
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-sm',
        !color && 'bg-surface-subtle text-ink-2',
        className,
      )}
      // `1f` en alpha : la même recette que la case à cocher d'une tâche, assez
      // de teinte pour se voir, assez peu pour ne pas crier.
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {icon}
    </span>
  )
}
