import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Libellé accessible — le texte visible vit à côté, dans la ligne de réglage. */
  label: string
  /**
   * Texte visible rendu *dans* le bouton, avant la piste. Sur mobile la maquette
   * rend toute la ligne tapable : sans ça, la cible se limiterait aux 38×22 px de
   * la piste, très en dessous des 44 px exigés.
   */
  children?: ReactNode
  className?: string
}

// Toggle pill 38×22 de la maquette. Vrai bouton avec role=switch : utilisable au
// clavier et annoncé correctement, contrairement au div cliquable du mock.
export function Switch({ checked, onChange, label, children, className }: SwitchProps) {
  const track = (
    <span
      className={cn(
        'flex h-[22px] w-[38px] shrink-0 items-center rounded-2xl p-0.5 transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-border-strong',
      )}
    >
      <span
        className={cn(
          'size-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
          checked && 'translate-x-4',
        )}
      />
    </span>
  )

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={children ? undefined : label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex shrink-0 cursor-pointer items-center rounded-2xl',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        children && 'min-h-11 w-full justify-between gap-2.5 text-left',
        className,
      )}
    >
      {children}
      {track}
    </button>
  )
}
