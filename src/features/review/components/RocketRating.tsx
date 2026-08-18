import { RocketIcon } from '../../../components/icons/RocketIcon'
import { cn } from '../../../lib/cn'
import {
  RATINGS,
  RATING_COLORS,
  RATING_LABELS,
  RATING_TILT,
  type Rating,
} from '../../../lib/reviewRating'

type RocketRatingProps = {
  value: number | null
  onChange: (rating: Rating) => void
  /** Ce que l'on note, pour un lecteur d'écran — la période change d'un écran à l'autre. */
  label: string
  /**
   * `full` : la fusée, son libellé et son indice — un objectif a droit à son
   * écran. `compact` : la fusée seule, en petit — un secondaire a droit à une
   * ligne. La différence de traitement **est** la définition du secondaire
   * (REFONTE §8), elle ne se rattrape pas.
   */
  size?: 'full' | 'compact'
}

const GEOMETRY = {
  full: { on: 46, off: 38 },
  compact: { on: 28, off: 24 },
} as const

/**
 * L'échelle à trois fusées — le geste central du produit.
 *
 * Les trois options restent toujours visibles ; c'est l'intensité qui distingue
 * celle qui est choisie (taille, couleur, halo), pas sa présence. L'utilisateur
 * voit donc en permanence l'échelle sur laquelle il se situe.
 */
export function RocketRating({
  value,
  onChange,
  label,
  size = 'full',
}: RocketRatingProps) {
  const compact = size === 'compact'
  const geometry = GEOMETRY[size]

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex justify-center',
        compact ? 'gap-1.5' : 'my-5 gap-4.5 lg:my-6 lg:gap-9',
      )}
    >
      {RATINGS.map((rating) => {
        const on = value === rating
        const color = RATING_COLORS[rating]!
        const { label: name, hint } = RATING_LABELS[rating]

        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${name} — ${hint}`}
            onClick={() => onChange(rating)}
            className={cn(
              'flex flex-col items-center rounded-lg transition-opacity duration-200',
              'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
              compact ? 'px-3.5 py-1' : 'gap-1.5 px-1.5 py-1',
              'cursor-pointer hover:opacity-100',
              on ? 'opacity-100' : 'opacity-32',
            )}
          >
            <RocketIcon
              withPort
              className="transition-all duration-250"
              style={{
                width: on ? geometry.on : geometry.off,
                height: on ? geometry.on : geometry.off,
                color: on ? color : '#9aa0b5',
                transform: RATING_TILT[rating],
                filter: on ? `drop-shadow(0 0 14px ${color}aa)` : undefined,
              }}
            />
            {/* Le libellé disparaît en compact, jamais le nom accessible : la
                fusée seule ne dit rien à un lecteur d'écran. */}
            {!compact && (
              <>
                <span
                  className={cn(on ? 'text-[12px] font-semibold' : 'text-[11px]')}
                  style={{ color: on ? color : '#9aa0b5' }}
                >
                  {name}
                </span>
                <span className="text-micro text-ink-onnight-faint">{hint}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
