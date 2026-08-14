import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
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
  /** Rendu du focus à la fermeture. */
  triggerRef?: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}

/**
 * Calque flottant à contenu libre — là où `Menu` impose une liste d'options. Il se
 * positionne en absolu : **son parent doit être `relative`**, en pratique le bouton
 * qui l'ouvre (même contrat que `Menu`).
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

  usePopoverDismiss({ open, onClose, panelRef, triggerRef })

  // Le focus part sur l'élément marqué par le contenu (la cellule du jour courant
  // pour un calendrier), une seule fois à l'ouverture.
  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
    triggerRef?.current?.focus()
  }

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'animate-fade-in absolute z-30 cursor-default rounded-panel border border-border bg-surface shadow-popover',
        align === 'right' ? 'right-0' : 'left-0',
        placement === 'top' && 'bottom-[calc(100%+10px)]',
        className,
      )}
      style={placement === 'bottom' ? { top: offset } : undefined}
    >
      {children}
    </div>
  )
}
