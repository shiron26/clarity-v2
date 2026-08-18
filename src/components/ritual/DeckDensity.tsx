import { cn } from '../../lib/cn'
import { HEAT_STEPS } from '../../lib/objectiveState'
import type { QuarterCell } from '../../lib/quarterTimeline'

type DeckDensityProps = {
  cells: QuarterCell[]
  /** Couleur pleine du slot — `skin.core`. */
  color: string
  className?: string
}

/**
 * Le rythme d'une période, en barres, **sur fond nuit**.
 *
 * Le jumeau sombre de la piste d'`ObjectiveQuarterRow` : mêmes cases, même
 * source (`buildQuarterRows`), deux terrains. Sur le nuit la hauteur porte
 * l'information autant que l'opacité — un fond sombre écrase les nuances basses,
 * là où le fond clair les tient très bien.
 *
 * **Ce n'est pas une suite de notes.** Chaque barre est la densité réellement
 * mesurée de sa période ; rater une semaine ne décolore pas les suivantes, la
 * rampe n'encode aucune série (§0.1, `heatLevel`).
 */
export function DeckDensity({ cells, color, className }: DeckDensityProps) {
  return (
    <div aria-hidden className={cn('flex items-end justify-center gap-[5px]', className)}>
      {cells.map((cell, i) => {
        // Hors fenêtre : rien du tout, pas même un socle — l'objectif n'existait
        // pas, et un trait gris se lirait comme une période vide.
        if (cell.kind === 'outside') return <span key={i} className="w-[9px]" />

        const level = cell.kind === 'level' ? cell.level : 0
        const filled = cell.kind === 'level' && level > 0
        return (
          <span
            key={i}
            className={cn(
              'w-[9px] rounded-[2px]',
              // Une période à venir est un contour, jamais un bloc plein — sinon
              // elle se lit comme une période ratée.
              cell.kind === 'future' && 'border border-dashed border-deck-idle',
              cell.kind === 'level' && level === 0 && 'bg-deck-idle',
            )}
            style={{
              height: 4 + level * 4,
              // Les crans bas restent lisibles sur le nuit sans que les hauts ne
              // crient plus fort que le chiffre au-dessus.
              ...(filled
                ? { backgroundColor: color, opacity: 0.45 + (level / (HEAT_STEPS - 1)) * 0.55 }
                : undefined),
            }}
          />
        )
      })}
    </div>
  )
}
