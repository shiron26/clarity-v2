import { useRef, useState } from 'react'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { PlusIcon } from '../../../components/icons/PlusIcon'
import { SearchIcon } from '../../../components/icons/SearchIcon'
import { Button } from '../../../components/ui/Button'
import { Kbd } from '../../../components/ui/Kbd'
import { Menu } from '../../../components/ui/Menu'
import { cn } from '../../../lib/cn'
import { type TaskScope } from '../taskScope'
import { SORT_LABELS, SORT_OPTIONS, type SortMode } from '../taskSort'
import { TaskViewSwitcher, type ScopeCounts } from './TaskViewSwitcher'

type TasksToolbarProps = {
  scope: TaskScope
  listId: string | null
  counts: ScopeCounts
  search: string
  onSearchChange: (value: string) => void
  sort: SortMode
  onSortChange: (mode: SortMode) => void
  onCreate: () => void
}

/**
 * L'en-tête de la carte de tâches (desktop). La maquette y réunit ce qui était
 * éparpillé au-dessus : les quatre vues à gauche, la création poussée à droite.
 *
 * La recherche et le tri s'intercalent entre les deux : la maquette ne les
 * dessine pas, mais la SPEC §5 les impose toujours (« recherche sur les titres,
 * côté client », « tri manuel par défaut, la seule autre option étant
 * l'importance ») — la maquette n'est pas exhaustive sur la barre d'outils.
 */
export function TasksToolbar({
  scope,
  listId,
  counts,
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
      {/* Purement décoratif : il cède la place aux quatre pastilles avant
          qu'elles ne se serrent. */}
      <span
        aria-hidden
        className="hidden size-[34px] shrink-0 items-center justify-center rounded-full bg-primary text-[15px] text-white xl:flex"
      >
        {scope === 'today' ? '☀' : <CalendarIcon className="size-4" />}
      </span>

      <TaskViewSwitcher
        scope={scope}
        listId={listId}
        counts={counts}
        variant="chips"
        className="shrink-0"
      />

      {/* Seule la recherche se comprime : les pastilles et les deux boutons
          gardent leur taille, sinon le libellé du bouton se casse en deux.

          Les trois contrôles font la même hauteur, et c'est un calcul, pas une
          coïncidence : `Button` en taille `md` fait `text-body` + `py-[9px]` sans
          bordure. Un contrôle bordé retrouve la même hauteur avec `py-2`, ses
          deux bordures d'un pixel remplaçant les deux pixels de padding
          manquants — la recette de la barre du dashboard. Sans bordure, comme la
          recherche, c'est `py-[9px]` tel quel. */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <label className="flex w-[130px] min-w-0 shrink items-center gap-[7px] rounded-md bg-canvas px-3 py-[9px] xl:w-[170px]">
          <SearchIcon className="size-[13px] shrink-0 text-ink-muted" />
          <span className="sr-only">Rechercher une tâche</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-placeholder"
          />
        </label>

        <span className="relative flex shrink-0">
          <button
            ref={sortTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((current) => !current)}
            className={cn(
              'cursor-pointer rounded-md border border-border bg-surface px-3.5 py-2 text-body font-medium whitespace-nowrap text-ink-3',
              'transition-colors duration-150 hover:border-border-primary-soft hover:text-primary',
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

        <Button
          onClick={onCreate}
          aria-keyshortcuts="N"
          title="Raccourci : N"
          className="shrink-0 gap-1.5 whitespace-nowrap"
        >
          <PlusIcon className="size-3.5" />
          Nouvelle tâche
          <Kbd className="ml-0.5">N</Kbd>
        </Button>
      </div>
    </div>
  )
}
