import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { PlusIcon } from '../../../components/icons/PlusIcon'
import { SearchIcon } from '../../../components/icons/SearchIcon'
import { Button } from '../../../components/ui/Button'
import { Menu } from '../../../components/ui/Menu'
import { cn } from '../../../lib/cn'
import { isDayScope, SCOPE_NAV_LABELS, type DateBucket, type TaskScope } from '../taskScope'
import { SORT_LABELS, SORT_OPTIONS, type SortMode } from '../taskSort'
import { scopeSearch } from '../taskViewParams'

type TasksToolbarProps = {
  scope: TaskScope
  /** Titre de la page — rendu pour les lecteurs d'écran seulement. */
  title: string
  /** Compteurs de la bascule Aujourd'hui ⇄ Demain. */
  dayCounts: { today: number; tomorrow: number }
  /** Compartiment de date affiché dans les vues multi-jours. */
  bucket: DateBucket
  onBucketChange: (bucket: DateBucket) => void
  bucketCounts: { dated: number; undated: number }
  search: string
  onSearchChange: (value: string) => void
  sort: SortMode
  onSortChange: (mode: SortMode) => void
  onCreate: () => void
}

const CHIP =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-[15px] py-[7px] text-[13px] whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none'

const ACTIVE_CHIP = 'bg-primary-soft font-semibold text-primary'

/**
 * L'en-tête de la carte de tâches (desktop). La maquette v2 y réunit ce qui
 * était éparpillé au-dessus : identité de la vue, recherche, tri et création.
 * En vue « jour », l'identité devient une bascule Aujourd'hui ⇄ Demain — c'est
 * le seul chemin vers « Demain », qui n'a pas d'entrée de navigation.
 */
export function TasksToolbar({
  scope,
  title,
  dayCounts,
  bucket,
  onBucketChange,
  bucketCounts,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onCreate,
}: TasksToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="mb-4 hidden items-center gap-2.5 lg:flex">
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-[15px] text-white"
      >
        {isDayScope(scope) ? '☀' : <CalendarIcon className="size-4" />}
      </span>

      {isDayScope(scope) ? (
        <>
          {/* La bascule est faite de deux liens : le titre de la page reste dû. */}
          <h1 className="sr-only">{title}</h1>
          <ScopeLink scope="today" active={scope === 'today'} count={dayCounts.today} />
          <ScopeLink scope="tomorrow" active={scope === 'tomorrow'} count={dayCounts.tomorrow} />
        </>
      ) : (
        <>
          {/* La v2 remplace le titre de vue par les deux compartiments de date :
              le titre reste dû, en lecture d'écran. */}
          <h1 className="sr-only">{title}</h1>
          <div role="radiogroup" aria-label="Compartiment de date" className="flex items-center gap-2.5">
            <BucketChip
              bucket="dated"
              label="Daté"
              active={bucket === 'dated'}
              count={bucketCounts.dated}
              onPick={onBucketChange}
            />
            <BucketChip
              bucket="undated"
              label="Sans date"
              active={bucket === 'undated'}
              count={bucketCounts.undated}
              onPick={onBucketChange}
            />
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <label className="flex w-[170px] items-center gap-[7px] rounded-md bg-canvas px-3 py-2">
          <SearchIcon className="size-[13px] shrink-0 text-ink-muted" />
          <span className="sr-only">Rechercher une tâche</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-label text-ink outline-none placeholder:text-placeholder"
          />
        </label>

        <span className="relative flex">
          <button
            ref={sortTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((current) => !current)}
            className={cn(
              'cursor-pointer rounded-md border border-border bg-surface px-3.5 py-2 text-label font-medium whitespace-nowrap text-ink-3',
              'transition-colors duration-150 hover:border-[#a9beff] hover:text-primary',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            )}
          >
            Trier · {SORT_LABELS[sort]} <span aria-hidden>▾</span>
          </button>

          <Menu
            open={sortOpen}
            onClose={() => setSortOpen(false)}
            label="Trier les tâches"
            triggerRef={sortTriggerRef}
            offset={36}
            className="min-w-[150px]"
            items={SORT_OPTIONS.map((mode) => ({
              id: mode,
              label: SORT_LABELS[mode],
              selected: mode === sort,
              onSelect: () => onSortChange(mode),
            }))}
          />
        </span>

        <Button onClick={onCreate} title="Raccourci : N" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Nouvelle tâche
        </Button>
      </div>
    </div>
  )
}

/** Une des deux pastilles de la bascule : une vraie navigation, donc un lien. */
function ScopeLink({
  scope,
  active,
  count,
}: {
  scope: 'today' | 'tomorrow'
  active: boolean
  count: number
}) {
  return (
    <Link
      to={{ pathname: '/taches', search: scopeSearch(scope) }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        CHIP,
        active ? ACTIVE_CHIP : 'font-medium text-ink-3 hover:bg-surface-subtle hover:text-ink',
      )}
    >
      {SCOPE_NAV_LABELS[scope]} {count}
    </Link>
  )
}

/**
 * Compartiment de date. Un bouton, pas un lien : contrairement à la portée, il ne
 * s'adresse pas — rien hors de cet en-tête ne le pilote (SPEC §5, rien n'est mémorisé).
 */
function BucketChip({
  bucket,
  label,
  active,
  count,
  onPick,
}: {
  bucket: DateBucket
  label: string
  active: boolean
  count: number
  onPick: (bucket: DateBucket) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onPick(bucket)}
      className={cn(
        CHIP,
        active ? ACTIVE_CHIP : 'font-medium text-ink-3 hover:bg-surface-subtle hover:text-ink',
      )}
    >
      {label} {count}
    </button>
  )
}
