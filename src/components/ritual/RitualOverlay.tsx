import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/**
 * L'enveloppe d'une cérémonie : rituel hebdomadaire (§7), bilan trimestriel (§8),
 * retour après absence (§9).
 *
 * C'est le seul morceau réellement partagé entre les trois — chacune a ses
 * écrans, toutes ont la même coquille : plein écran par-dessus l'application
 * (sidebar comprise), un dégradé sombre, `← Quitter` et des pastilles de
 * progression en pied. Pendant deux minutes, il n'y a rien d'autre à faire.
 *
 * Dans `src/components/` et non dans une feature : une feature n'importe jamais
 * d'une autre (AGENTS.md), et les trois cérémonies vivent dans des tranches
 * différentes.
 */

// Doit couvrir `animate-fade-out` (fadeOut 0.45s) : plus court, l'overlay
// disparaîtrait d'un coup au milieu de son fondu.
const CLOSE_MS = 450

type RitualOverlayProps = {
  /** Ce que la cérémonie est, pour un lecteur d'écran. */
  label: string
  /**
   * Rang de l'écran, à partir de 1. Absent = l'écran est hors décompte : c'est
   * le cas de la projection finale, qui n'est pas une étape mais ce que le
   * rituel rend.
   */
  step?: number
  total?: number
  onClose: () => void
  children: ReactNode
}

export function RitualOverlay({ label, step, total, onClose, children }: RitualOverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [closing, setClosing] = useState(false)

  // `closing` est aussi lu par le raccourci clavier, dont l'effet ne se
  // réabonne pas à chaque rendu : sans cette ref il y verrait toujours `false`,
  // et deux Échap rapprochés programmeraient deux fermetures.
  const closingRef = useRef(false)

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    if (reducedMotion) {
      onClose()
      return
    }
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }, [reducedMotion, onClose])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn(
        'bg-deck-gradient fixed inset-0 z-60 flex flex-col overflow-y-auto',
        'px-5 pt-6.5 pb-4 lg:px-11 lg:pt-7.5 lg:pb-4.5',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      {/* Colonne unique et étroite, centrée verticalement — le contrat de la
          maquette : un sur-titre, un contenu, une action. Au-delà de ~430 px les
          cartes s'étalent et la cérémonie se met à ressembler à une page. */}
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <div className="flex w-full max-w-[430px] flex-col items-center text-center">
          {children}
        </div>
      </div>

      <div className="flex flex-none items-center justify-center gap-2.5 pt-3.5 pb-1">
        <button
          type="button"
          onClick={handleClose}
          className="mr-2.5 cursor-pointer rounded-xs p-1.5 text-label text-ink-onnight transition-colors duration-150 hover:text-white focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
        >
          ← Quitter
        </button>

        {/* Décoratives : le rang de l'écran est déjà porté par son sur-titre. */}
        {total !== undefined &&
          Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'h-[7px] rounded-[4px] transition-all duration-300',
                step !== undefined && i + 1 === step ? 'w-5.5' : 'w-[7px]',
                step !== undefined && i + 1 <= step ? 'bg-primary' : 'bg-deck-idle',
              )}
            />
          ))}
      </div>
    </div>
  )
}
