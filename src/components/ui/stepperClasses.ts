// L'apparence d'une flèche de stepper, sans sa coquille.
//
// Même raison d'être que `buttonClasses` : le pas d'année est fait de `<button>`
// (il change un état local) et le pas de trimestre de `<Link>` (il change
// d'adresse), or un `<Link>` ne peut pas *être* un `YearStepper`. Sans ce module,
// les deux recopieraient les mêmes classes et divergeraient — c'est déjà arrivé
// une fois, les trimestres portaient des chevrons `‹ ›` gris clair là où les
// années ont des triangles pleins.
import { cn } from '../../lib/cn'

/**
 * Glyphes texte et non icônes : DESIGN.md proscrit les icônes pleines, et ces
 * deux-là se lisent mieux que n'importe quel chevron à cette taille.
 */
export const STEP_PREV = '◀'
export const STEP_NEXT = '▶'

export type StepperSize = 'sm' | 'lg'

/**
 * `sm` = en ligne dans un en-tête dense, `lg` = repère principal de l'écran.
 *
 * Un pas indisponible reste **affiché et lisible**, en gris de bordure : le faire
 * disparaître décalerait le libellé d'un cran à chaque bout de la série.
 */
export function stepperArrowClasses(options?: {
  size?: StepperSize
  disabled?: boolean
  className?: string
}): string {
  const { size = 'sm', disabled = false, className } = options ?? {}

  return cn(
    'rounded-xs focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
    size === 'lg' ? 'flex size-[30px] items-center justify-center text-ui' : 'px-1.5 py-1 text-body',
    disabled
      ? 'cursor-default text-border-strong'
      : 'cursor-pointer text-ink-3 hover:bg-surface-subtle hover:text-ink',
    className,
  )
}
