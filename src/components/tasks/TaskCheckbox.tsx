import { useMemo, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon } from '../icons/CheckIcon'

type TaskCheckboxProps = {
  done: boolean
  /** Titre de la tâche — sert à composer le libellé accessible. */
  title: string
  onToggle: () => void
  /**
   * Couleur de l'objectif lié (ou de la liste) : elle teinte la bordure au repos
   * et remplit la case une fois cochée. `null` = case neutre.
   */
  accent?: string | null
  /** 19 px au lieu de 21 px : densité mobile de la maquette. */
  compact?: boolean
  /** Joue le rebond de la case et la gerbe de particules. */
  bursting?: boolean
  className?: string
}

const NEUTRAL = '#1a66ff'

/**
 * La case à cocher d'une tâche. Ce n'est pas le `Checkbox` du design system :
 * celui-ci porte une couleur venue de la base (objectif ou liste), ce qu'une
 * classe statique ne peut pas exprimer, et il embarque la gerbe de complétion.
 */
export function TaskCheckbox({
  done,
  title,
  onToggle,
  accent = null,
  compact = false,
  bursting = false,
  className,
}: TaskCheckboxProps) {
  const fill = accent ?? NEUTRAL

  return (
    <span className={cn('relative flex shrink-0', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Décocher ${title}` : `Cocher ${title}`}
        onClick={onToggle}
        className={cn(
          'flex cursor-pointer items-center justify-center border-2 text-white',
          compact ? 'size-[19px] rounded-[7px]' : 'size-[21px] rounded-sm',
          'transition-[background-color,border-color] duration-150',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
          !done && !accent && 'border-border-idle hover:border-ink-muted',
          bursting && 'animate-cb-pop',
        )}
        style={
          done
            ? { backgroundColor: fill, borderColor: fill }
            : accent
              ? { borderColor: accent, backgroundColor: `${accent}14` }
              : undefined
        }
      >
        {done && <CheckIcon className={compact ? 'size-2' : 'size-2.5'} />}
      </button>

      {bursting && <CheckBurst color={fill} />}
    </span>
  )
}

const BURST_COUNT = 8

/** Gerbe et anneau autour de la case au moment où on coche. Décoratif. */
function CheckBurst({ color }: { color: string }) {
  const particles = useMemo(
    () =>
      Array.from({ length: BURST_COUNT }, (_, i) => {
        const angle = (i * Math.PI) / 4 + 0.35
        const distance = 22 + (i % 2) * 9
        const size = i % 2 ? 4 : 6
        return {
          size,
          color: i % 3 === 0 ? '#ffd43b' : color,
          tx: `${Math.cos(angle) * distance}px`,
          ty: `${Math.sin(angle) * distance}px`,
        }
      }),
    [color],
  )

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={
            {
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              background: p.color,
              '--tx': p.tx,
              '--ty': p.ty,
              animation: 'fxBurst .65s ease-out forwards',
            } as CSSProperties
          }
        />
      ))}
      <span
        className="animate-fx-ring absolute rounded-full border-2"
        style={{ inset: -3, borderColor: color }}
      />
    </span>
  )
}
