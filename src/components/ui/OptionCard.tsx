import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * La carte-réponse du parcours : un titre, une explication, et l'état
 * sélectionné signalé par la bordure et le fond — pas par une pastille ronde.
 *
 * Ce sont de vrais boutons radio pour un lecteur d'écran : la maquette ne pose
 * que des classes, mais trois cartes qui s'excluent sont un `radiogroup`, et la
 * sémantique n'attend pas le design (AGENTS.md).
 */

/**
 * `columns` : deux réponses courtes (Semaine / Mois) tiennent sur une ligne et
 * se comparent mieux côte à côte. Au-delà de deux, ou dès que le texte
 * s'allonge, l'empilement reste la règle — c'est le cas de toutes les questions
 * du parcours de création.
 */
export function OptionCardGroup({
  label,
  columns = 1,
  children,
}: {
  label: string
  columns?: 1 | 2
  children: ReactNode
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('gap-2.5', columns === 2 ? 'grid grid-cols-2' : 'flex flex-col')}
    >
      {children}
    </div>
  )
}

type OptionCardProps = {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  description: ReactNode
  /**
   * Illustration posée au-dessus du titre. Elle prend la couleur de l'état
   * sélectionné, comme la bordure : deux signaux valent mieux qu'un quand les
   * cartes sont côte à côte et que le regard ne les compare pas ligne à ligne.
   */
  icon?: ReactNode
  /**
   * Réponse indisponible. La carte **reste lisible** : c'est sa description qui
   * porte la raison, et une réponse qu'on retire sans la dire est exactement le
   * défaut qu'on corrige. D'où une bordure pointillée et un titre atténué plutôt
   * qu'une opacité globale, qui rendrait le texte illisible.
   */
  disabled?: boolean
}

export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  disabled = false,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'block w-full rounded-panel border-[1.5px] px-4 py-[15px] text-left',
        'transition-[background-color,border-color] duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        disabled
          ? 'cursor-default border-dashed border-border bg-canvas'
          : selected
            ? 'cursor-pointer border-primary bg-primary-soft'
            : 'cursor-pointer border-border bg-surface hover:border-border-primary-soft hover:bg-[#fbfcff]',
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            'mb-2 block',
            disabled ? 'text-ink-muted' : selected ? 'text-primary' : 'text-ink-3',
          )}
        >
          {icon}
        </span>
      )}
      <span
        className={cn('block text-ui font-semibold', disabled ? 'text-ink-3' : 'text-ink')}
      >
        {title}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-ink-muted">{description}</span>
    </button>
  )
}
