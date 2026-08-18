import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type DeckEyebrowProps = {
  children: ReactNode
  className?: string
}

/**
 * Le sur-titre d'un écran de cérémonie : la période, ou l'état du rituel.
 *
 * Cinq fichiers portaient la chaîne de classes en dur, et elle avait déjà
 * divergé — une des copies avait perdu sa paire `lg:` et rendait un sur-titre
 * plus petit que les autres sur grand écran.
 */
export function DeckEyebrow({ children, className }: DeckEyebrowProps) {
  return (
    <p
      className={cn(
        'text-[10px] font-semibold tracking-[1.4px] text-ink-onnight uppercase',
        'lg:text-[11px] lg:tracking-[1.5px]',
        className,
      )}
    >
      {children}
    </p>
  )
}
