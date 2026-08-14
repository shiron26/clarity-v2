import type { List } from '../../../hooks/useLists'
import { cn } from '../../../lib/cn'

type ListPillsProps = {
  lists: List[]
  value: string | null
  onChange: (listId: string | null) => void
}

const BASE =
  'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-[11px] transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none'

/** Choix de la liste. Cliquer la liste déjà sélectionnée la retire. */
export function ListPills({ lists, value, onChange }: ListPillsProps) {
  if (lists.length === 0) return null

  return (
    <div role="radiogroup" aria-label="Liste" className="flex flex-wrap gap-2">
      {lists.map((list) => {
        const selected = value === list.id
        return (
          <button
            key={list.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : list.id)}
            className={cn(
              BASE,
              selected
                ? 'border-[#a9beff] bg-primary-soft font-semibold text-primary'
                : 'border-border bg-canvas text-ink-3 hover:border-[#a9beff]',
            )}
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: list.color ?? '#9a9aa6' }}
            />
            {list.name}
          </button>
        )
      })}
    </div>
  )
}
