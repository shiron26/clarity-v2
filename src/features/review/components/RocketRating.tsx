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
  disabled?: boolean
}

/**
 * L'échelle à trois fusées — le geste central du produit.
 *
 * Les trois options restent toujours visibles ; c'est l'intensité qui distingue
 * celle qui est choisie (taille, couleur, halo), pas sa présence. L'utilisateur
 * voit donc en permanence l'échelle sur laquelle il se situe.
 */
export function RocketRating({ value, onChange, disabled = false }: RocketRatingProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Note de la semaine"
      className="my-5 flex justify-center gap-4.5 lg:my-6 lg:gap-9"
    >
      {RATINGS.map((rating) => {
        const on = value === rating
        const color = RATING_COLORS[rating]!
        const { label, hint } = RATING_LABELS[rating]

        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} — ${hint}`}
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg px-1.5 py-1 transition-opacity duration-200',
              'focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none',
              disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-100',
              on ? 'opacity-100' : 'opacity-32',
            )}
          >
            <RocketIcon
              withPort
              className="transition-all duration-250"
              style={{
                width: on ? 46 : 38,
                height: on ? 46 : 38,
                color: on ? color : '#9aa0b5',
                transform: RATING_TILT[rating],
                filter: on ? `drop-shadow(0 0 14px ${color}aa)` : undefined,
              }}
            />
            <span
              className={cn(on ? 'text-[12px] font-semibold' : 'text-[11px]')}
              style={{ color: on ? color : '#9aa0b5' }}
            >
              {label}
            </span>
            <span className="text-micro text-[#565866]">{hint}</span>
          </button>
        )
      })}
    </div>
  )
}
