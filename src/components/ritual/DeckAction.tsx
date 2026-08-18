import type { ReactNode } from 'react'
import { buttonClasses } from '../ui/buttonClasses'

type DeckActionProps = {
  onClick: () => void
  children: ReactNode
  /** La marge haute, seule chose qui change vraiment d'un deck à l'autre. */
  className?: string
  disabled?: boolean
  /** Décalage d'entrée, quand le bouton clôt une cascade d'animations. */
  delay?: string
}

/**
 * L'unique action d'un écran de cérémonie.
 *
 * Douze endroits recopiaient le même `buttonClasses({ variant: 'deck', size:
 * 'deck' })` + `animate-slide-up`, ne différant que par la marge et le libellé —
 * exactement le mode de panne que `buttonClasses.ts` documente déjà pour les
 * boutons ordinaires.
 */
export function DeckAction({ onClick, children, className, disabled, delay }: DeckActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses({
        variant: 'deck',
        size: 'deck',
        className: `animate-slide-up ${className ?? ''}`,
      })}
      style={delay ? { animationDelay: delay } : undefined}
    >
      {children}
    </button>
  )
}
