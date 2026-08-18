import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type DeckCardProps = {
  children: ReactNode
  /** Rang dans une liste : décale l'entrée pour que les cartes se posent l'une après l'autre. */
  index?: number
  className?: string
}

/**
 * La surface d'un élément listé dans une cérémonie — un objectif à réparer, une
 * tâche à trier, une ligne de projection.
 *
 * Alignée à gauche alors que le deck est centré : une liste se lit en colonne,
 * et centrer des titres de longueurs différentes les ferait danser d'une ligne à
 * l'autre.
 *
 * Le décalage d'entrée est calculé depuis `index` et non écrit en dur — l'ancien
 * écran de review portait un `animationDelay: '1.9s'` fixe sur son bouton, qui
 * tombait à côté dès que le nombre d'objectifs changeait.
 */
export function DeckCard({ children, index = 0, className }: DeckCardProps) {
  return (
    <div
      className={cn(
        'animate-slide-up w-full rounded-xl border border-deck-line bg-deck-card px-4.5 py-4 text-left',
        className,
      )}
      style={{ animationDelay: `${0.08 + index * 0.07}s` }}
    >
      {children}
    </div>
  )
}
