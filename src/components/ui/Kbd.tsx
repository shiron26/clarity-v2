import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Le cartouche d'une touche de clavier, à poser dans le libellé de l'action
 * qu'elle déclenche : c'est le seul endroit où l'utilisateur a une chance de
 * découvrir un raccourci — une page d'aide dédiée, personne ne l'ouvre.
 *
 * Le fond dérive de `currentColor` plutôt que d'un token : le même cartouche
 * doit tenir sur un bouton bleu plein (blanc translucide) comme sur une surface
 * claire (gris tramé), sans variante à choisir à l'appel.
 *
 * Purement visuel : le raccourci s'annonce aux lecteurs d'écran par
 * `aria-keyshortcuts` sur le contrôle, pas en glissant une lettre orpheline dans
 * son nom accessible.
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      aria-hidden
      className={cn(
        'rounded-[5px] bg-current/20 px-[5px] py-px font-sans text-caption font-semibold',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
