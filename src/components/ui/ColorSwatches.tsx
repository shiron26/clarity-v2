import { cn } from '../../lib/cn'
import { LIST_PALETTE, listColorName } from '../../lib/listPalette'

type ColorSwatchesProps = {
  value: string
  onChange: (color: string) => void
  colors?: readonly string[]
  /** Libellé du groupe (« Couleur de la liste Sport »…). */
  label: string
  className?: string
}

/**
 * Choix de couleur dans la palette fixe. Les couleurs venant de la base ne
 * peuvent pas être des classes statiques : la pastille reste en style inline.
 */
export function ColorSwatches({
  value,
  onChange,
  colors = LIST_PALETTE,
  label,
  className,
}: ColorSwatchesProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-3.5', className)}>
      {colors.map((color) => {
        const selected = color === value
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={listColorName(color)}
            onClick={() => onChange(color)}
            className={cn(
              'size-4 shrink-0 cursor-pointer rounded-full transition-[transform,box-shadow] duration-150',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              selected ? 'scale-110' : 'hover:scale-105',
            )}
            style={{
              backgroundColor: color,
              boxShadow: selected
                ? `0 0 0 2px #fff, 0 0 0 2.5px ${color}, 0 3px 6px rgb(0 0 0 / 0.18)`
                : undefined,
            }}
          />
        )
      })}
    </div>
  )
}
