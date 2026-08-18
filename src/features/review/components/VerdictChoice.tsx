import { cn } from '../../../lib/cn'

type VerdictChoiceProps = {
  value: boolean | null
  onChange: (achieved: boolean) => void
  /** Ce que l'on juge, pour un lecteur d'écran. */
  label: string
  /** `full` : au milieu d'un deck. `compact` : dans la ligne d'un secondaire. */
  size?: 'full' | 'compact'
}

/**
 * Atteint / Pas atteint — la conclusion d'un objectif dont la fenêtre se ferme.
 *
 * Prend la place des fusées au bilan de trimestre pour un objectif trimestriel,
 * et **seul** au bilan annuel (`review_item.achieved`). Ce n'est pas une note
 * dégradée à deux crans : une note dit un rythme, un verdict clôt une histoire.
 * D'où deux boutons de même poids plutôt qu'une échelle — il n'y a pas de milieu
 * entre atteint et pas atteint, et en fabriquer un inviterait à ne pas trancher.
 *
 * « Pas atteint » ne porte **aucun rouge** : c'est une des deux issues normales
 * d'un objectif, pas une erreur. La couleur d'échec transformerait la cérémonie
 * en jugement, exactement ce que la refonte enlève.
 */
export function VerdictChoice({
  value,
  onChange,
  label,
  size = 'full',
}: VerdictChoiceProps) {
  const compact = size === 'compact'

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex w-full gap-2.5', compact ? 'gap-2' : 'my-5 lg:my-6')}
    >
      {[
        { achieved: true, text: 'Atteint' },
        { achieved: false, text: 'Pas atteint' },
      ].map((option) => {
        const on = value === option.achieved

        return (
          <button
            key={option.text}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.achieved)}
            className={cn(
              'flex-1 rounded-xl border-[1.5px] font-semibold',
              compact ? 'px-3 py-2 text-label' : 'px-4 py-3.5 text-ui',
              'transition-[background-color,border-color,color] duration-150',
              'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
              'cursor-pointer',
              on
                ? 'border-primary bg-primary/16 text-white'
                : 'border-deck-line bg-deck-card text-ink-onnight hover:border-deck-idle',
            )}
          >
            {option.text}
          </button>
        )
      })}
    </div>
  )
}
