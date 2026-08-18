// L'apparence d'un bouton, sans sa coquille `<button>`.
//
// Dans un module à part et non dans `Button.tsx` : un fichier de composant ne doit
// exporter que des composants, sinon le fast refresh perd le fil (même raison que
// `objectiveState.ts` à côté d'`ObjectiveCard`).
//
// Un `<Link>` ne peut pas *être* un `Button` — react-router rend une ancre, et le
// composant est figé sur `ButtonHTMLAttributes`. Quatre endroits du dépôt recopiaient
// donc ces classes à la main, et divergeaient déjà entre eux : l'un oubliait
// `active:shadow`, l'autre n'avait pas d'anneau de focus.
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'deck'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'deck'

// DESIGN.md : jamais de bouton sans triplet hover / active / focus explicite.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-primary text-white shadow-primary',
    'hover:bg-primary-hover hover:shadow-primary-hover hover:-translate-y-px',
    'active:bg-primary-active active:shadow-primary-active active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    // Désactivé : plus d'accent bleu, plus d'ombre, plus de mouvement. La maquette
    // met du blanc sur gris (contraste ~1.9:1) — on garde un texte lisible à la place.
    'disabled:bg-field disabled:text-ink-muted disabled:shadow-none disabled:translate-y-0',
  ),
  secondary: cn(
    'bg-surface text-ink-2 border-[1.5px] border-border',
    'hover:border-border-strong',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    'disabled:text-ink-muted disabled:border-border disabled:translate-y-0',
  ),
  ghost: cn(
    'bg-transparent text-ink-3',
    'hover:bg-surface-subtle hover:text-ink',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    'disabled:text-ink-muted disabled:bg-transparent disabled:translate-y-0',
  ),
  danger: cn(
    'bg-transparent text-ink-muted',
    'hover:bg-danger-bg hover:text-danger',
    'active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-danger/28',
    'disabled:text-ink-muted disabled:bg-transparent disabled:translate-y-0',
  ),
  // L'action d'un deck de cérémonie. Le halo remplace l'ombre portée : sur un
  // fond sombre une ombre ne se voit pas, c'est la lueur qui détache le bouton.
  // Désactivé, il perd le bleu — sur un deck, un bouton bleu grisé se lirait
  // encore comme cliquable.
  deck: cn(
    'bg-primary text-white shadow-[0_0_34px_rgb(43_92_255/0.45)]',
    'hover:bg-primary-hover hover:shadow-[0_0_46px_rgb(43_92_255/0.62)] hover:-translate-y-0.5',
    'active:bg-primary-active active:translate-y-px',
    'focus-visible:ring-3 focus-visible:ring-primary/32',
    'disabled:bg-deck-idle disabled:text-ink-onnight disabled:shadow-none disabled:translate-y-0',
  ),
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-body px-3 py-1.5 rounded-sm gap-1.5',
  md: 'text-body px-4 py-[9px] rounded-md gap-2',
  lg: 'text-ui px-[18px] py-[14px] rounded-lg gap-2',
  // L'unique action d'un écran de cérémonie : généreuse au doigt (48 px de haut,
  // le seuil de cible tactile), resserrée au curseur où elle est seule au milieu
  // d'un écran vide et n'a plus besoin de crier.
  deck: 'min-h-12 rounded-panel px-7.5 text-ui gap-2 lg:min-h-0 lg:rounded-lg lg:px-6.5 lg:py-3 lg:text-body',
}

export function buttonClasses(options?: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}): string {
  const { variant = 'primary', size = 'md', fullWidth = false, className } = options ?? {}
  return cn(
    'inline-flex cursor-pointer items-center justify-center font-medium',
    'transition-[background-color,box-shadow,transform,border-color] duration-150',
    'outline-none focus-visible:outline-none',
    'disabled:cursor-default',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  )
}
