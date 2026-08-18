import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type DeckCardHeaderProps = {
  /** Couleur du slot de l'objectif — dynamique, donc en style inline. */
  color: string
  title: string
  /** L'état à droite : un compteur, un verdict. */
  trailing?: ReactNode
  /** La marge basse, seule chose qui varie d'une carte à l'autre. */
  className?: string
}

/**
 * L'identité d'un objectif en tête d'une carte de deck : sa pastille, son titre,
 * son état. Les trois cartes de réparation du rituel le recopiaient à l'identique.
 *
 * Le titre est tronqué, jamais replié : une carte de cérémonie tient sur une
 * hauteur connue, et un titre long ne doit pas pousser le reste hors de l'écran.
 */
export function DeckCardHeader({ color, title, trailing, className }: DeckCardHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <h3 className="min-w-0 flex-1 truncate text-ui font-semibold text-white">{title}</h3>
      {trailing}
    </div>
  )
}
