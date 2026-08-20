import type { ReactElement, ReactNode } from 'react'
import * as Primitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/cn'

/**
 * L'infobulle du produit, posée sur Radix Tooltip.
 *
 * Pas de mécanique maison : une infobulle correcte doit suivre son ancre au
 * défilement, se retourner près d'un bord, s'ouvrir aussi au clavier (focus) et
 * pas seulement au survol, se fermer sur Échap, et se décrire aux lecteurs
 * d'écran. Radix fait tout cela sans imposer d'apparence — c'est nous qui la
 * donnons ici, et nulle part ailleurs.
 *
 * Elle remplace l'attribut `title` du navigateur, qui met une seconde à
 * apparaître, ne se met pas en forme, et ne s'ouvre jamais au clavier.
 *
 * Portalisée dans `document.body` : posée dans le flux, elle serait rognée par
 * le premier parent en `overflow` du chemin (même piège que `DragOverlay`).
 *
 * Une infobulle ne remplace pas un libellé accessible : elle le COMPLÈTE. Un
 * bouton sans texte garde son `aria-label` (voir `TooltipIconButton`).
 */
export function Tooltip({
  content,
  side = 'top',
  children,
}: {
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Le déclencheur. Un unique élément : Radix lui greffe ses props. */
  children: ReactElement
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={7}
          collisionPadding={12}
          className={cn(
            'animate-fade-in z-90 max-w-64 rounded-md bg-night px-2.5 py-2 shadow-popover',
            'text-label leading-snug text-white',
          )}
        >
          {content}
          <Primitive.Arrow className="fill-night" width={11} height={5} />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

/**
 * Le contenu d'une infobulle informative : ce que l'action s'appelle, puis ce
 * qu'elle fait vraiment.
 *
 * Le nom seul ne vaut pas une infobulle — il redit l'icône ou le libellé qui est
 * déjà à l'écran. C'est la seconde ligne qui la justifie : la conséquence, la
 * limite, la règle qu'on ne peut pas dessiner.
 */
export function TooltipLines({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <span className="block font-semibold">{title}</span>
      {hint && <span className="mt-0.5 block text-ink-onnight-strong">{hint}</span>}
    </>
  )
}

/**
 * À monter UNE fois, au-dessus de tout ce qui porte une infobulle.
 *
 * Le fournisseur ne sert pas qu'à câbler le contexte : c'est lui qui tient le
 * délai partagé. Passé d'une infobulle à sa voisine, la seconde s'ouvre
 * immédiatement au lieu de refaire attendre — sans lui, deux boutons côte à côte
 * donnent l'impression que le survol répond mal.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={280} skipDelayDuration={400}>
      {children}
    </Primitive.Provider>
  )
}
