import { Link } from 'react-router'
import { cn } from '../../../lib/cn'

/**
 * L'invitation à prendre une place restante, quand un objectif existe déjà.
 *
 * **Trois est un plafond, pas un quota.** Deux grandes cartes pointillées à côté
 * d'un seul objectif transformeraient « trois maximum » en « il vous en manque
 * deux » — d'où une affordance unique et discrète, qui ne concurrence pas la
 * vraie carte. C'est l'état vide qui porte les trois invitations, pas celui-ci.
 */
export function ObjectiveSlotInvite({ freeSlots }: { freeSlots: number }) {
  const count = freeSlots === 1 ? 'une place libre' : `${freeSlots} places libres`

  return (
    <Link
      to="/objectifs"
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-panel border-[1.5px] border-dashed border-border-strong bg-surface-sidebar px-4 py-3.5 text-center',
        'transition-[border-color,background-color] duration-150 hover:border-border-primary-soft hover:bg-primary-tint',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        'lg:rounded-2xl lg:py-5',
        // Desktop : le bouton occupe les colonnes restantes de la grille de 3.
        freeSlots === 2 && 'lg:col-span-2',
      )}
    >
      <span className="text-body font-semibold text-ink-3">+ Ajouter un objectif</span>
      <span className="text-[11px] leading-relaxed text-ink-muted">
        {count} — rien ne vous oblige à {freeSlots === 1 ? 'la' : 'les'} prendre
      </span>
    </Link>
  )
}
