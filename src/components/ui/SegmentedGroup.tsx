import { cn } from '../../lib/cn'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

type SegmentedGroupProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** Libellé du groupe pour les lecteurs d'écran (« Récurrence »…). */
  label: string
  className?: string
}

/**
 * « Toggle pill group » de DESIGN.md : conteneur `#ecebe6` radius 12 padding 4,
 * segment actif en fond blanc surélevé. Sert à la récurrence dans les deux
 * modales de tâche.
 */
export function SegmentedGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-wrap gap-[3px] rounded-lg bg-field p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer rounded-sm px-3 py-2 text-label whitespace-nowrap',
              'transition-[background-color,box-shadow,color] duration-150',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              selected
                ? 'bg-surface font-semibold text-ink shadow-[0_2px_5px_rgb(0_0_0/0.1)]'
                : 'font-medium text-ink-3 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
