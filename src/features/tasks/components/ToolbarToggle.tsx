import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../../../lib/cn'
import { Tooltip, TooltipLines } from '../../../components/ui/Tooltip'

type ToolbarToggleProps = {
  active: boolean
  tone?: 'default' | 'danger'
  children: ReactNode
  onClick: () => void
  /**
   * L'infobulle du segment, quand son libellé ne suffit pas à dire ce qu'il fait.
   *
   * `title` nomme le réglage, `hint` en donne la conséquence. Deux segments en
   * ont besoin : « Important », dont l'effet ne se voit qu'au tri, et la
   * récurrence, qui affiche sa VALEUR (« Aucune ») et non son rôle.
   */
  tooltip?: { title: string; hint?: string }
  /** Nécessaire quand le segment déclenche un `Popover` (rendu du focus). */
  ref?: Ref<HTMLButtonElement>
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>

/**
 * Segment de la barre d'outils des modales de tâche (DESIGN.md « toggle pill
 * group ») : actif = fond blanc surélevé dans un conteneur `#ecebe6`.
 */
export function ToolbarToggle({
  active,
  tone = 'default',
  children,
  onClick,
  tooltip,
  className,
  ref,
  ...rest
}: ToolbarToggleProps) {
  const button = (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-3 py-2 text-label whitespace-nowrap',
        'transition-[background-color,box-shadow,color] duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        active
          ? cn(
              'bg-surface font-semibold shadow-[0_2px_5px_rgb(0_0_0/0.1)]',
              tone === 'danger' ? 'text-danger' : 'text-ink',
            )
          : 'font-medium text-ink-3 hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  )

  if (!tooltip) return button

  return (
    <Tooltip content={<TooltipLines title={tooltip.title} hint={tooltip.hint} />}>
      {button}
    </Tooltip>
  )
}
