import { Link } from 'react-router'
import { cn } from '../../../lib/cn'
import {
  MOBILE_SCOPE_ORDER,
  SCOPE_NAV_LABELS,
  SCOPE_ORDER,
  SCOPE_SEGMENT_LABELS,
  type TaskScope,
} from '../taskScope'
import { scopeSearch } from '../taskViewParams'

export type ScopeCounts = Record<TaskScope, number>

type TaskViewSwitcherProps = {
  scope: TaskScope
  /** La liste ouverte, reconduite par chaque lien : changer de vue depuis une
   *  liste filtre dedans au lieu d'en sortir. */
  listId: string | null
  /** Ce qui reste à faire dans chaque vue — le retard compris là où il s'affiche. */
  counts: ScopeCounts
  /** `chips` en desktop, `segments` en mobile. */
  variant: 'chips' | 'segments'
  className?: string
}

/**
 * Les quatre vues de l'écran (REFONTE §5). Toujours des `Link` : la vue vit
 * dans l'URL — c'est de l'adressage, pas de la persistance (la SPEC interdit de
 * mémoriser un filtre), et c'est ce qui permet à la sidebar de piloter l'écran
 * sans rien importer de la feature.
 *
 * Deux arbres derrière un `return` anticipé plutôt qu'un seul arbre à classes
 * `hidden` : les deux variantes n'ont ni la même liste de vues, ni les mêmes
 * libellés, ni la même mise en page. Ce qui leur est commun tient dans les
 * pièces internes ci-dessous.
 */
export function TaskViewSwitcher({
  scope,
  listId,
  counts,
  variant,
  className,
}: TaskViewSwitcherProps) {
  if (variant === 'segments') {
    return (
      <div className={cn('flex min-w-0 flex-1 rounded-[11px] bg-canvas p-[3px]', className)}>
        {MOBILE_SCOPE_ORDER.map((candidate) => (
          <ScopeSegment
            key={candidate}
            scope={candidate}
            listId={listId}
            active={scope === candidate}
            count={counts[candidate]}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {SCOPE_ORDER.map((candidate) => (
        <ScopeChip
          key={candidate}
          scope={candidate}
          listId={listId}
          active={scope === candidate}
          count={counts[candidate]}
        />
      ))}
    </div>
  )
}

const CHIP =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-[15px] py-[7px] text-[13px] whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none'

function ScopeChip({
  scope,
  listId,
  active,
  count,
}: {
  scope: TaskScope
  listId: string | null
  active: boolean
  count: number
}) {
  return (
    <Link
      to={{ pathname: '/taches', search: scopeSearch(scope, listId) }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        CHIP,
        active
          ? 'bg-primary-soft font-semibold text-primary'
          : 'font-medium text-ink-3 hover:bg-surface-subtle hover:text-ink',
      )}
    >
      {SCOPE_NAV_LABELS[scope]} {count > 0 && <span aria-hidden>{count}</span>}
    </Link>
  )
}

/** Piste pleine largeur, fond `canvas`, segment actif en blanc surélevé — la
 *  primitive `SegmentedGroup` est en `bg-field` et pilotée par callback, elle ne
 *  saurait pas naviguer. */
function ScopeSegment({
  scope,
  listId,
  active,
  count,
}: {
  scope: TaskScope
  listId: string | null
  active: boolean
  count: number
}) {
  return (
    <Link
      to={{ pathname: '/taches', search: scopeSearch(scope, listId) }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 py-[9px]',
        'text-[12.5px] whitespace-nowrap transition-colors duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        active
          ? 'bg-surface font-semibold text-primary shadow-[0_1px_3px_rgb(23_24_31/0.12)]'
          : 'font-medium text-ink-faint',
      )}
    >
      {SCOPE_SEGMENT_LABELS[scope]} {count > 0 && <span aria-hidden>{count}</span>}
    </Link>
  )
}
