import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { usePopoverDismiss } from '../../hooks/usePopoverDismiss'
import { cn } from '../../lib/cn'

export type MenuItem = {
  id: string
  label: string
  /** Pastille de couleur ou glyphe posé avant le libellé. */
  leading?: ReactNode
  selected?: boolean
  onSelect: () => void
}

type MenuProps = {
  open: boolean
  onClose: () => void
  items: MenuItem[]
  /** Libellé du menu pour les lecteurs d'écran (« Choisir une liste »…). */
  label: string
  /** Bord sur lequel le panneau s'aligne. La maquette aligne tout à droite. */
  align?: 'left' | 'right'
  /** Décalage vertical depuis le haut du déclencheur (30 px sur une pastille). */
  offset?: number
  /** Rendu du focus à la fermeture. */
  triggerRef?: RefObject<HTMLElement | null>
  className?: string
}

/**
 * Menu déroulant du design system (DESIGN.md « Dropdown menu »). Il se positionne
 * en absolu : **son parent doit être `relative`** — en pratique le bouton qui
 * l'ouvre, comme dans la maquette.
 *
 * La maquette n'ouvre ces menus qu'à la souris ; ici ils sont navigables au
 * clavier (flèches, Début/Fin, Échap) et rendent le focus au déclencheur.
 */
export function Menu({
  open,
  onClose,
  items,
  label,
  align = 'right',
  offset = 30,
  triggerRef,
  className,
}: MenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Le focus part sur l'entrée sélectionnée, **une seule fois** à l'ouverture :
  // `items` est recréé à chaque rendu, le mettre en dépendance ramènerait le
  // focus au début à chaque frappe de flèche.
  useEffect(() => {
    if (!open) return
    const options = panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    if (!options?.length) return
    const selected = Array.prototype.findIndex.call(
      options,
      (o: HTMLElement) => o.getAttribute('aria-checked') === 'true',
    )
    options[selected < 0 ? 0 : selected]?.focus()
  }, [open])

  usePopoverDismiss({ open, onClose, panelRef, triggerRef })

  useEffect(() => {
    if (!open) return

    function close() {
      onClose()
      triggerRef?.current?.focus()
    }

    function onKeyDown(event: KeyboardEvent) {
      const options = panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
      if (!options?.length) return
      const current = document.activeElement as HTMLElement | null
      const index = Array.prototype.indexOf.call(options, current)

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          close()
          break
        case 'ArrowDown':
          event.preventDefault()
          options[(index + 1 + options.length) % options.length]?.focus()
          break
        case 'ArrowUp':
          event.preventDefault()
          options[(index - 1 + options.length) % options.length]?.focus()
          break
        case 'Home':
          event.preventDefault()
          options[0]?.focus()
          break
        case 'End':
          event.preventDefault()
          options[options.length - 1]?.focus()
          break
        case 'Tab':
          // Sortir du menu au clavier le referme : il ne survit pas au focus.
          close()
          break
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, triggerRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      className={cn(
        'animate-fade-in absolute z-20 min-w-[140px] rounded-lg border border-border bg-surface p-1.5 shadow-dropdown',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
      style={{ top: offset }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitemradio"
          aria-checked={!!item.selected}
          onClick={(event) => {
            event.stopPropagation()
            item.onSelect()
            onClose()
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-left text-body font-normal whitespace-nowrap text-ink-2',
            'transition-colors duration-150 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none',
          )}
        >
          {item.leading}
          <span className="flex-1">{item.label}</span>
          <span aria-hidden className="text-caption text-primary">
            {item.selected ? '✓' : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
