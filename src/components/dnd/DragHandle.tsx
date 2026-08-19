import { cn } from '../../lib/cn'
import type { DragHandleProps } from './useSortableItem'

/**
 * La poignée `⠿`, unique pour les quatre points de saisie du produit (ligne de
 * tâche desktop et mobile, ligne de liste, widget).
 *
 * `touch-none` n'est pas décoratif : c'est lui qui empêche le navigateur de
 * défiler depuis ce point, et donc ce qui permet de se passer d'un délai
 * d'appui long au doigt.
 */
export function DragHandle({
  label,
  handleProps,
  active,
  className,
}: {
  label: string
  handleProps: DragHandleProps
  active: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      // Étalés AVANT nos propres attributs : `aria-label` et `className` doivent
      // gagner, mais `role`, `tabIndex`, `aria-roledescription`,
      // `aria-describedby` et les écouteurs viennent de dnd-kit et doivent
      // survivre. Le `ref` désigne la poignée comme déclencheur du geste.
      {...handleProps.attributes}
      {...handleProps.listeners}
      ref={handleProps.ref}
      aria-label={label}
      className={cn(
        'shrink-0 cursor-grab touch-none px-0.5 text-[12px] leading-none text-border-idle',
        'transition-colors duration-150 hover:text-ink-muted',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        active && 'cursor-grabbing text-primary',
        className,
      )}
    >
      <span aria-hidden>⠿</span>
    </button>
  )
}
