import { useNavigate } from 'react-router'
import { Modal } from '../../../components/ui/Modal'
import type { List } from '../../../hooks/useLists'
import { cn } from '../../../lib/cn'
import { SCOPE_NAV_LABELS, SCOPE_ORDER, type TaskScope } from '../taskScope'
import { SORT_LABELS, SORT_OPTIONS, type SortMode } from '../taskSort'
import { listSearch, scopeSearch } from '../taskViewParams'
import { DEFAULT_LIST_COLOR } from '../../../lib/listPalette'

type MobileViewSheetProps = {
  open: boolean
  onClose: () => void
  scope: TaskScope
  listId: string | null
  lists: List[]
  /** Les quatre vues sont listées ici : le sélecteur de la carte n'en montre
   *  que trois, faute de largeur. */
  counts: Record<TaskScope, number>
  sort: SortMode
  onSortChange: (mode: SortMode) => void
  onManageLists: () => void
}

const LABEL = 'mt-4.5 mb-2 text-[10px] font-semibold tracking-[1.2px] text-ink-muted'
const ROW =
  'flex min-h-[46px] w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none'

// La maquette marque la ligne active par son fond et sa couleur, sans coche.
const ACTIVE_LABEL = (active: boolean) =>
  active ? 'font-semibold text-primary' : 'font-normal text-ink'

/** Vue, liste et tri en une seule feuille : la maquette mobile n'a qu'un bouton. */
export function MobileViewSheet({
  open,
  onClose,
  scope,
  listId,
  lists,
  counts,
  sort,
  onSortChange,
  onManageLists,
}: MobileViewSheetProps) {
  const navigate = useNavigate()

  function go(search: string) {
    navigate({ pathname: '/taches', search })
    onClose()
  }

  const scopes = SCOPE_ORDER

  return (
    <Modal open={open} onClose={onClose} title="Afficher" variant="sheet">
      <div className="flex flex-col">
        <p className={cn(LABEL, 'mt-0')} id="mobile-view-scopes">
          VUE
        </p>
        <div role="group" aria-labelledby="mobile-view-scopes" className="flex flex-col">
          {scopes.map((candidate) => {
            const active = scope === candidate
            return (
              <button
                key={candidate}
                type="button"
                aria-current={active}
                onClick={() => go(scopeSearch(candidate, listId))}
                className={cn(ROW, active && 'bg-primary-soft')}
              >
                <span className={cn('flex-1 text-[13.5px]', ACTIVE_LABEL(active))}>
                  {SCOPE_NAV_LABELS[candidate]}
                </span>
                <span
                  className={cn(
                    'rounded-2xl px-2.5 py-0.5 text-label font-semibold',
                    active ? 'bg-primary/12 text-primary' : 'bg-surface-subtle text-ink-muted',
                  )}
                >
                  {counts[candidate]}
                </span>
              </button>
            )
          })}
        </div>

        <p className={LABEL} id="mobile-view-lists">
          LISTES
        </p>
        <div role="group" aria-labelledby="mobile-view-lists" className="flex flex-col">
          {lists.map((list) => {
            const active = listId === list.id
            return (
              <button
                key={list.id}
                type="button"
                aria-current={active}
                onClick={() => go(listSearch(list.id))}
                className={cn(ROW, active && 'bg-primary-soft')}
              >
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: list.color ?? DEFAULT_LIST_COLOR }}
                />
                <span className={cn('flex-1 text-[13.5px]', ACTIVE_LABEL(active))}>
                  {list.name}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={onManageLists}
            className={cn(ROW, 'text-[12.5px] text-ink-muted')}
          >
            ✎ Gérer les listes
          </button>
        </div>

        <p className={LABEL} id="mobile-view-sort">
          TRIER PAR
        </p>
        <div role="radiogroup" aria-labelledby="mobile-view-sort" className="flex flex-col">
          {SORT_OPTIONS.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mode === sort}
              onClick={() => {
                onSortChange(mode)
                onClose()
              }}
              className={cn(ROW, mode === sort && 'bg-primary-soft')}
            >
              <span className={cn('flex-1 text-[13.5px]', ACTIVE_LABEL(mode === sort))}>
                {SORT_LABELS[mode]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
