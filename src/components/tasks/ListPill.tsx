import { forwardRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ListPillProps = {
  /** Nom de la liste. Ignoré en variante `dashed` (l'invite prime). */
  name: string
  color?: string | null
  /** `sm` = ligne de dashboard et ligne mobile ; `md` = ligne de l'écran Tâches. */
  size?: 'sm' | 'md'
  /** Invite « + Liste » : pastille en pointillés, sans point de couleur. */
  dashed?: boolean
  /** Présent = la pastille devient un bouton (menu de choix de liste). */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  'aria-haspopup'?: 'menu'
  'aria-expanded'?: boolean
  children?: ReactNode
  className?: string
}

// `sm` reste la pastille blanche bordée des lignes compactes ; `md` est celle de
// l'écran Tâches, que la maquette v2 pose en gris plein — la ligne y porte déjà
// assez de bordures.
const SIZES = {
  sm: 'gap-1.5 px-2.5 py-0.5 text-[9.5px] font-semibold',
  md: 'gap-1.5 px-3 py-[5px] text-[11px] font-normal',
} as const

const TONES = {
  sm: 'border border-border bg-surface text-ink-2',
  md: 'bg-canvas text-ink-2 hover:bg-[#f0efe9]',
} as const

const DOT = { sm: 'size-[5px]', md: 'size-[5px]' } as const

/**
 * Pastille de liste : point de la couleur de la liste + son nom. La couleur vient
 * de la base, elle reste en style inline. Avec `onClick`, la pastille devient le
 * déclencheur d'un menu — c'est le cas sur l'écran Tâches.
 */
export const ListPill = forwardRef<HTMLButtonElement, ListPillProps>(function ListPill(
  { name, color, size = 'md', dashed = false, onClick, children, className, ...aria },
  ref,
) {
  const content = (
    <>
      {!dashed && (
        <span
          aria-hidden
          className={cn('shrink-0 rounded-full', DOT[size])}
          style={{ backgroundColor: color ?? '#9a9aa6' }}
        />
      )}
      {/* Le nom se tronque plutôt que d'imposer sa largeur : sans borne, une
          liste au nom long élargit la ligne de tâche, puis la carte qui la
          contient — jusqu'à déborder du viewport en mobile. */}
      <span className="truncate">{dashed ? '+ Liste' : name}</span>
      {children}
    </>
  )

  const base = cn(
    'flex min-w-0 items-center rounded-2xl whitespace-nowrap',
    SIZES[size],
    dashed
      ? 'border border-dashed border-border-idle font-semibold text-ink-muted'
      : TONES[size],
    className,
  )

  if (!onClick) {
    return <span className={base}>{content}</span>
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...aria}
      className={cn(
        base,
        'relative cursor-pointer transition-colors duration-150',
        // La pastille pleine (`md`) n'a pas de bordure : son survol passe par le fond.
        (dashed || size === 'sm') && 'hover:border-[#a9beff]',
        dashed && 'hover:text-primary',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
      )}
    >
      {content}
    </button>
  )
})
