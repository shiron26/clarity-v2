import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

/**
 * Durée de la sortie, en millisecondes — **doit rester alignée** sur les `@utility`
 * `animate-sheet-down` / `animate-slide-down` / `animate-scrim-out` de
 * `src/index.css`. C'est ce délai qui décide du démontage : trop court, la feuille
 * disparaît en pleine descente ; trop long, elle reste figée hors écran.
 */
const EXIT_MS = 360

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
  /**
   * Reçoit la fermeture animée. Les modales montées avec `open` en dur et qui se
   * referment elles-mêmes (envoi réussi) doivent appeler `closeRef.current?.()`
   * plutôt que leur `onClose` : sinon leur hôte les démonte avant que la feuille
   * ait eu le temps de redescendre. Inutile quand l'hôte pilote un vrai `open` —
   * la modale voit alors le passage à `false` et joue la sortie toute seule.
   */
  closeRef?: RefObject<(() => void) | null>
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
  closeRef,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  // `null` : rien en cours. `self` : la fermeture a été demandée ici, il faudra
  // prévenir le parent une fois la descente jouée. `parent` : il a déjà basculé
  // `open`, on ne joue plus que l'animation — le rappeler ferait doublon.
  const [closing, setClosing] = useState<'self' | 'parent' | null>(null)

  // `onClose` est presque toujours une lambda, recréée à chaque rendu du parent :
  // la lire dans une ref est ce qui empêche le minuteur de sortie de se relancer
  // à chaque re-rendu — la feuille ne se démonterait jamais. Même raison pour
  // `closing`, qui garderait `requestClose` instable.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const closingRef = useRef(closing)
  closingRef.current = closing

  const requestClose = useCallback(() => {
    if (closingRef.current) return
    // Sans mouvement, la sortie n'a rien à montrer : on ferme sec.
    if (reducedMotion) {
      onCloseRef.current()
      return
    }
    setClosing('self')
  }, [reducedMotion])

  // Lu depuis l'écouteur clavier, qui ne doit pas se réabonner quand `closing`
  // change : le faire relancerait l'autofocus en pleine fermeture.
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    if (!closeRef) return
    closeRef.current = requestClose
    return () => {
      closeRef.current = null
    }
  }, [closeRef, requestClose])

  // Le parent a fermé sans passer par nos affordances (envoi réussi, changement
  // d'écran) : on garde la feuille à l'écran le temps de la faire redescendre.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setClosing(null)
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    setClosing(reducedMotion ? null : 'parent')
  }, [open, reducedMotion])

  useEffect(() => {
    if (!closing) return
    const id = setTimeout(() => {
      setClosing(null)
      if (closing === 'self') {
        // Avant `onClose`, sinon le passage de `open` à `false` qu'il provoque
        // relancerait une sortie « parent » et la feuille remonterait.
        wasOpen.current = false
        onCloseRef.current()
      }
    }, EXIT_MS)
    return () => clearTimeout(id)
  }, [closing])

  // Le verrou de défilement suit la présence à l'écran, pas `open` : sans ça la
  // page reprendrait sa main derrière une feuille encore en train de descendre.
  useEffect(() => {
    if (!open && !closing) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open, closing])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        requestCloseRef.current()
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

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open && !closing) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center bg-[rgb(16_17_22/0.45)] sm:items-start sm:pt-30',
        closing ? 'animate-scrim-out' : 'animate-fade-in',
        scrimClassName,
      )}
      onClick={requestClose}
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
              // `flex flex-col` : c'est ce qui permet à un contenu de pousser son
              // pied en bas de feuille (`mt-auto`) au lieu de le laisser flotter au
              // milieu quand le formulaire est court. Le panneau desktop n'a pas de
              // hauteur imposée, il repasse en bloc.
              cn(
                'flex h-full flex-col overflow-y-auto sm:block sm:h-auto',
                closing
                  ? 'animate-sheet-down sm:animate-slide-down'
                  : 'animate-sheet-up sm:animate-slide-up',
              )
            : closing
              ? 'animate-slide-down'
              : 'animate-slide-up',
          // Plus rien à cliquer une fois la descente lancée : un second appui
          // n'a aucun effet utile et déclencherait le focus d'un champ qui part.
          closing && 'pointer-events-none',
          className,
        )}
      >
        {/* Poignée de feuille, mobile uniquement — et raccourci de fermeture : en
            variant `sheet` le panneau couvre tout l'écran, il ne reste aucun scrim
            à toucher. `aria-hidden` parce que c'est un doublon tactile du ✕, qui
            reste le contrôle accessible : annoncer un bouton qu'aucun clavier ne
            peut atteindre serait pire que de le taire. La barre visible fait 4 px ;
            c'est la bande autour d'elle qui reçoit le doigt, d'où les marges
            négatives qui la font déborder du padding du panneau. */}
        <div
          aria-hidden
          onClick={requestClose}
          className="-mx-6 -mt-6 mb-1 flex shrink-0 cursor-pointer justify-center px-6 pt-6 pb-4 sm:hidden"
        >
          <span className="h-1 w-9 rounded-sm bg-border" />
        </div>

        {/* En mobile le ✕ fait 28 px face à un titre de 14,5 px, et l'alignement sur
            la ligne de base le fait déborder sous elle : 6 px de marge et le premier
            champ vient le frôler. Le panneau desktop, lui, garde la maquette. */}
        <div className="mb-4 flex shrink-0 items-baseline justify-between gap-4 sm:mb-1.5">
          <h2 id={titleId} className="text-card font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Fermer"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm bg-field text-ink-2 transition-colors duration-150 hover:bg-border-strong focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            ✕
          </button>
        </div>

        {children}

        {footer && (
          <div className="mt-5 shrink-0 border-t border-surface-subtle pt-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
