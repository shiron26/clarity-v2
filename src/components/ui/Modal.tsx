import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Bloc collé en bas, séparé par un filet (actions). */
  footer?: ReactNode
  /**
   * `panel` (défaut) : feuille basse courte en mobile.
   * `sheet` : feuille **pleine hauteur** qui monte du bas, pour les formulaires
   * longs (nouvelle tâche, gestion des listes) — c'est ce que fait la maquette.
   * En desktop les deux se ressemblent : panneau ancré en haut.
   */
  variant?: 'panel' | 'sheet'
  className?: string
  /** Surcharge du voile — sert à ajuster l'ancrage vertical du panneau. */
  scrimClassName?: string
}

// DESIGN.md : scrim rgba(16,17,22,.45), contenu blanc radius 20 padding 24,
// modale ancrée EN HAUT de l'écran, jamais centrée verticalement.
// En mobile, la maquette passe en feuille ancrée en bas avec une poignée.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'panel',
  className,
  scrimClassName,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Piège à focus minimal : la modale ne doit pas laisser filer le focus
      // derrière le scrim.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables?.length) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // Le champ marqué `data-autofocus` prend le focus, sinon le premier élément
    // focusable — sans ça, le bouton de fermeture le récupère toujours, puisqu'il
    // est le premier du panneau.
    const target =
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panelRef.current?.querySelector<HTMLElement>('button, input')
    target?.focus()

    // La feuille mobile occupe tout l'écran : sans ce verrou, le doigt fait
    // défiler la page derrière elle une fois arrivé en bout de panneau.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[rgb(16_17_22/0.45)] sm:items-start sm:pt-30',
        scrimClassName,
      )}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // pb : le panneau mobile est collé au bas de l'écran, ses 24 px passeraient
          // sous l'indicateur d'accueil en app installée (et en variant `sheet` le
          // dernier champ deviendrait inatteignable). `sm:pb-6` rétablit la valeur
          // normale dès que le panneau décolle du bord.
          'w-full rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-modal',
          'sm:w-[480px] sm:max-h-[86vh] sm:overflow-y-auto sm:rounded-2xl sm:pb-6',
          variant === 'sheet'
            ? // Feuille pleine hauteur en mobile ; le panneau desktop reprend
              // l'entrée classique (les variantes `sm:` gagnent dans la media query).
              'animate-sheet-up h-full overflow-y-auto sm:h-auto sm:animate-slide-up'
            : 'animate-slide-up',
          className,
        )}
      >
        {/* poignée de feuille, mobile uniquement */}
        <div className="mx-auto mb-5 h-1 w-9 rounded-sm bg-border sm:hidden" />

        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <h2 id={titleId} className="text-card font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-field text-ink-2 transition-colors duration-150 hover:bg-border-strong focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            ✕
          </button>
        </div>

        {children}

        {footer && <div className="mt-5 border-t border-surface-subtle pt-4">{footer}</div>}
      </div>
    </div>
  )
}
