import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { usePopoverDismiss } from '../../hooks/usePopoverDismiss'
import { cn } from '../../lib/cn'

type PopoverProps = {
  open: boolean
  onClose: () => void
  /** Nom accessible du calque (« Choisir une échéance »…). */
  label: string
  /** `top` s'ouvre au-dessus du déclencheur, `bottom` en dessous. */
  placement?: 'top' | 'bottom'
  align?: 'left' | 'right'
  /** Décalage depuis le haut du déclencheur, `placement="bottom"` uniquement. */
  offset?: number
  /**
   * Le déclencheur : **obligatoire**, c'est l'ancre du calcul de position, et
   * c'est aussi lui qui reprend le focus à la fermeture.
   */
  triggerRef: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}

/** Marge minimale gardée entre le calque et le bord de la fenêtre. */
const GUTTER = 8

/** Écart entre le calque et son déclencheur, `placement="top"` ou après bascule. */
const GAP = 10

/**
 * Calque flottant à contenu libre — là où `Menu` impose une liste d'options.
 *
 * Il se positionne en **`fixed`, dans le repère de la fenêtre**, à partir du
 * rectangle de son déclencheur. En absolu il dépendait d'un parent `relative`,
 * donc du premier ancêtre positionné : dans une modale, ce parent était le
 * panneau, qui défile (`overflow-y-auto`) et rogne ce qui en sort. Un calendrier
 * de 240 px ouvert depuis la barre du bas d'une modale de 330 px ne pouvait tenir
 * ni au-dessus ni en dessous — il débordait par le haut, à cheval sur le
 * formulaire. En `fixed`, aucun ancêtre ne le contraint : un élément fixe n'est
 * rogné que par un ancêtre qui lui sert de bloc conteneur, c'est-à-dire porteur
 * d'un `transform`. **C'est exactement ce que laissait `animation-fill-mode: both`
 * sur l'entrée du panneau** : une matrice identité résiduelle, suffisante pour
 * capturer le calque et le faire rogner. Les entrées de modale sont donc en
 * `backwards` (`src/index.css`) — y revenir casserait ce composant sans que rien
 * ici ne le laisse deviner.
 *
 * Pas de portail pour autant : sortir le nœud de l'arbre React ferait perdre la
 * gestion d'Échap ci-dessous, qui repose sur la propagation synthétique.
 *
 * Échap est traité par un `onKeyDown` **React**, pas par un écouteur `document` :
 * `Modal` en a déjà un, posé plus tôt, et deux écouteurs `document` se déclenchent
 * dans l'ordre d'inscription — la modale se fermerait à la place du popover. React
 * délègue à la racine de l'application, qui est un descendant de `document`, donc
 * `stopPropagation()` sur l'événement synthétique coupe bien celui de `Modal`.
 */
export function Popover({
  open,
  onClose,
  label,
  placement = 'bottom',
  align = 'right',
  offset = 30,
  triggerRef,
  className,
  children,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box | null>(null)

  usePopoverDismiss({ open, onClose, panelRef, triggerRef })

  /**
   * Mesure avant peinture : `useLayoutEffect` rend une seconde passe dans la même
   * image, donc le calque n'apparaît jamais à sa position provisoire.
   *
   * Le déclencheur se remesure au défilement — en capture, pour attraper aussi
   * celui d'un conteneur interne — et au redimensionnement : un calque fixe ne
   * suit pas son ancre tout seul.
   */
  useLayoutEffect(() => {
    if (!open) return

    function measure() {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const panel = panelRef.current
      if (!trigger || !panel) return
      setBox({ trigger, width: panel.offsetWidth, height: panel.offsetHeight })
    }

    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, triggerRef])

  // Une fermeture doit repartir d'une mesure fraîche : garder l'ancienne ferait
  // clignoter le calque à la position de son ouverture précédente.
  useEffect(() => {
    if (!open) setBox(null)
  }, [open])

  /**
   * Le focus part sur l'élément marqué par le contenu (la cellule du jour courant
   * pour un calendrier), une seule fois à l'ouverture.
   *
   * **C'est aussi ce qui fait marcher Échap** : sans focus à l'intérieur, la
   * touche est reçue par le `body`, le `onKeyDown` React ci-dessous ne se
   * déclenche jamais, et l'écouteur `document` de `Modal` ferme la modale entière
   * au lieu du seul calque.
   *
   * D'où la dépendance à `measured` et non au seul `open` : tant que la mesure
   * n'a pas eu lieu, le calque est en `visibility: hidden`, et **un élément
   * invisible n'est pas focalisable** — `focus()` y est un appel sans effet.
   */
  const measured = box !== null
  useEffect(() => {
    if (!open || !measured) return
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [open, measured])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
    triggerRef.current?.focus()
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'animate-fade-in fixed z-30 cursor-default rounded-panel border border-border bg-surface shadow-popover',
        className,
      )}
      style={popoverStyle(box, placement, align, offset)}
    >
      {children}
    </div>
  )
}

type Box = { trigger: DOMRect; width: number; height: number }

/**
 * Les coordonnées du calque dans le repère de la fenêtre.
 *
 * Deux règles seulement, et une bascule : le calque s'aligne sur un bord de son
 * déclencheur, s'ouvre du côté demandé, et **passe de l'autre côté** s'il n'y a
 * pas la place — sans quoi « ne plus être rogné par la modale » se paierait d'un
 * calque hors écran. Les positions restent ensuite bornées à la fenêtre.
 *
 * Tant que rien n'est mesuré (première passe de rendu), le calque est masqué :
 * `useLayoutEffect` corrige avant la peinture, personne ne voit ce cadre.
 */
function popoverStyle(
  box: Box | null,
  placement: 'top' | 'bottom',
  align: 'left' | 'right',
  offset: number,
): CSSProperties {
  if (!box) return { visibility: 'hidden' }

  const { trigger, width, height } = box
  const { innerWidth, innerHeight } = window

  const left =
    align === 'left'
      ? clamp(trigger.left, GUTTER, innerWidth - width - GUTTER)
      : clamp(trigger.right - width, GUTTER, innerWidth - width - GUTTER)

  // `offset` se compte depuis le HAUT du déclencheur : c'est la convention des
  // appelants, qui l'ont réglée sur la hauteur de leur bouton.
  const below = trigger.top + offset
  const above = trigger.top - GAP - height

  const top =
    placement === 'top'
      ? above >= GUTTER
        ? above
        : trigger.bottom + GAP
      : below + height <= innerHeight - GUTTER
        ? below
        : trigger.top - GAP - height

  return { left, top: clamp(top, GUTTER, Math.max(GUTTER, innerHeight - height - GUTTER)) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
