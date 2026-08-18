import { cn } from '../../../lib/cn'
import { type TaskScope } from '../taskScope'
import { TaskViewSwitcher, type ScopeCounts } from './TaskViewSwitcher'

type TasksCardHeaderMobileProps = {
  scope: TaskScope
  listId: string | null
  counts: ScopeCounts
  onOpenFilters: () => void
}

/**
 * En-tête de la carte de tâches en mobile (maquette). Il porte ce que le
 * desktop étale sur une ligne : les trois vues qui tiennent sur 390 px, et
 * l'accès à tout le reste — « Toutes », les listes et le tri vivent dans la
 * feuille de filtres.
 */
export function TasksCardHeaderMobile({
  scope,
  listId,
  counts,
  onOpenFilters,
}: TasksCardHeaderMobileProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2 lg:hidden">
      <TaskViewSwitcher scope={scope} listId={listId} counts={counts} variant="segments" />

      <button
        type="button"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        title="Filtrer et trier"
        aria-label="Filtrer et trier"
        className={cn(
          'flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-[11px] bg-canvas text-ink-2',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        )}
      >
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
      </button>
    </div>
  )
}
