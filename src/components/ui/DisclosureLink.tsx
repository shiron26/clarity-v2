import type { ReactNode } from 'react'
import { PlusIcon } from '../icons/PlusIcon'
import { buttonClasses } from './buttonClasses'
import { cn } from '../../lib/cn'

/**
 * Le contrôle qui ouvre un champ replié — « Ajouter un pourquoi », « Ajouter une
 * cible totale ».
 *
 * Un champ facultatif affiché en permanence n'est pas neutre : il se lit comme
 * une case à remplir, et pousse à inventer une valeur là où il n'y en a pas.
 * Replié, il ne coûte rien à qui n'en a pas besoin, et reste à un clic de qui en
 * veut un.
 *
 * **C'est un bouton, pas un lien de texte.** La première version était une ligne
 * de 11 px en gris atténué, posée au-dessus d'une aide de la même taille et de
 * la même couleur : rien ne disait qu'elle se cliquait. Un bouton secondaire
 * porte une bordure, un `+`, et se distingue du texte quelle que soit sa
 * voisine. Sa taille `sm` le garde discret face à l'action principale de
 * l'écran.
 *
 * Dans `src/components/ui/` parce que la modale d'édition d'objectif et le
 * formulaire de création s'en servent, et qu'un composant partagé ne peut pas
 * vivre dans une feature (AGENTS.md).
 */
export function DisclosureLink({
  onClick,
  className,
  children,
}: {
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonClasses({
        variant: 'secondary',
        size: 'sm',
        className: cn('text-ink-2 hover:text-ink', className),
      })}
    >
      <PlusIcon className="size-3.5 text-ink-muted" />
      {children}
    </button>
  )
}
