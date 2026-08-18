import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

// `size` est omis des attributs natifs : sur un <select> il désigne le nombre
// de lignes visibles, ce qui n'a rien à voir avec la densité du contrôle.
type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  children: ReactNode
  /** Compacte le contrôle pour une barre d'outils (le défaut est un champ de formulaire). */
  size?: 'sm' | 'md'
  /**
   * Occuper toute la largeur disponible plutôt que celle de l'option la plus
   * longue. À réserver aux cas où le conteneur borne déjà la largeur (une
   * cellule de grille, un `flex-1`) : par défaut le contrôle se dimensionne sur
   * son contenu, sans quoi une option se retrouve tronquée.
   */
  fullWidth?: boolean
  className?: string
  wrapperClassName?: string
}

const SIZES: Record<'sm' | 'md', string> = {
  sm: 'rounded-md py-2.5 pr-8.5 pl-3.5 text-body',
  md: 'rounded-lg py-[14px] pr-8.5 pl-4 text-ui',
}

/**
 * Un `<select>` **natif**, pas un menu maison : c'est un vrai contrôle de
 * formulaire, et sur mobile il ouvre le sélecteur système, bien meilleur que
 * tout ce qu'on écrirait. `Menu` reste pour les listes d'actions ; ici on choisit
 * une valeur.
 *
 * `appearance-none` supprime le chevron du navigateur, qu'on redessine pour
 * qu'il suive les tokens. Il est `pointer-events-none` : c'est le `<select>` qui
 * reçoit le clic, sur toute sa surface.
 *
 * La largeur est **intrinsèque par défaut** — un select se dimensionne sur son
 * option la plus longue, et `min-w-26` n'est qu'un plancher. Lui imposer une
 * largeur fixe tronque le libellé le jour où une option s'allonge.
 */
export function Select({
  children,
  size = 'md',
  fullWidth = false,
  className,
  wrapperClassName,
  ...rest
}: SelectProps) {
  return (
    <span
      className={cn('relative inline-block max-w-full', fullWidth && 'w-full', wrapperClassName)}
    >
      <select
        className={cn(
          'min-w-26 cursor-pointer appearance-none border-[1.5px] border-border bg-surface',
          'text-ink transition-[border-color,box-shadow] duration-150',
          'outline-none hover:border-border-strong focus:border-primary focus:ring-3 focus:ring-primary/14',
          'disabled:cursor-default disabled:bg-surface-subtle disabled:text-ink-muted',
          fullWidth && 'w-full',
          SIZES[size],
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[11px] text-ink-muted"
      >
        ▾
      </span>
    </span>
  )
}
