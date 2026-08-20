import { cn } from '../../lib/cn'
import type { DragHandleProps } from './useSortableItem'

/**
 * La poignée `⠿`, unique pour les quatre points de saisie du produit (ligne de
 * tâche desktop et mobile, ligne de liste, widget).
 *
 * `touch-none` n'est pas décoratif : c'est lui qui empêche le navigateur de
 * défiler depuis ce point, et donc ce qui permet de se passer d'un délai
 * d'appui long au doigt.
 *
 * Deux tons, et le choix suit ce que la poignée doit annoncer. `subtle` est la
 * poignée d'une LIGNE : elle se tait dans une liste qu'on vient lire, et se
 * révèle au survol. `solid` est celle d'un mode où déplacer EST le travail —
 * le mode Organiser de l'accueil, où le glisser-déposer n'était deviné par
 * personne : elle prend alors la forme d'un bouton, pas d'un décor.
 */
export function DragHandle({
  label,
  handleProps,
  active,
  tone = 'subtle',
  className,
}: {
  label: string
  handleProps: DragHandleProps
  active: boolean
  tone?: 'subtle' | 'solid'
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
        'shrink-0 cursor-grab touch-none leading-none transition-colors duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        tone === 'subtle'
          ? 'px-0.5 text-[12px] text-border-idle hover:text-ink-muted'
          : 'inline-flex size-7 items-center justify-center rounded-sm bg-field text-[14px] text-ink-2 hover:bg-border-strong hover:text-ink',
        active && (tone === 'subtle' ? 'cursor-grabbing text-primary' : 'cursor-grabbing bg-primary-soft text-primary'),
        className,
      )}
    >
      <span aria-hidden>⠿</span>
    </button>
  )
}
