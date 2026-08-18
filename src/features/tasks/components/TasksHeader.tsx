import { cn } from '../../../lib/cn'

type TasksHeaderProps = {
  title: string
  /** La couleur de la liste ouverte, `null` hors vue liste : elle commande la
   *  pastille, que les quatre portées n'ont pas. */
  color?: string | null
  /** Rendu seulement en vue « liste ». */
  onManageLists?: () => void
}

/**
 * En-tête de page : le titre de la vue, aux deux largeurs. Une liste y ajoute
 * sa pastille de couleur — c'est le seul endroit qui la nomme, les onglets de
 * `TasksToolbar` ne disent que la portée. Le déclencheur de filtres mobile est
 * descendu dans `TasksCardHeaderMobile`.
 */
export function TasksHeader({ title, color, onManageLists }: TasksHeaderProps) {
  return (
    <div className="flex items-center gap-3.5">
      <h1 className="flex min-w-0 items-center gap-2.5 text-[23px] font-medium">
        {color && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="truncate">{title}</span>
      </h1>

      {onManageLists && (
        <button
          type="button"
          onClick={onManageLists}
          className={cn(
            'hidden cursor-pointer rounded-xs px-2 py-1.5 text-[11px] text-ink-muted lg:block',
            'transition-colors duration-150 hover:text-primary',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
          )}
        >
          ✎ Gérer les listes
        </button>
      )}
    </div>
  )
}
