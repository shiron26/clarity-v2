import { Link } from 'react-router'
import { cn } from '../../../lib/cn'
import { isDayScope, SCOPE_NAV_LABELS, type DateBucket, type TaskScope } from '../taskScope'
import { scopeSearch } from '../taskViewParams'

type TasksCardHeaderMobileProps = {
  scope: TaskScope
  dayCounts: { today: number; tomorrow: number }
  bucket: DateBucket
  onBucketChange: (bucket: DateBucket) => void
  bucketCounts: { dated: number; undated: number }
  onOpenFilters: () => void
}

/**
 * En-tête de la carte de tâches en mobile (maquette v2). Il porte ce que le
 * desktop étale sur une ligne : la bascule de la vue et l'accès aux filtres.
 *
 * Le segmenté n'est pas `SegmentedGroup` : cette primitive est en `bg-field`,
 * largeur automatique et actif `text-ink`, là où la maquette veut un contrôle
 * pleine largeur en `bg-canvas` avec un segment blanc surélevé. Deux props
 * utilisées une seule fois coûteraient plus cher que ces quelques lignes.
 */
export function TasksCardHeaderMobile({
  scope,
  dayCounts,
  bucket,
  onBucketChange,
  bucketCounts,
  onOpenFilters,
}: TasksCardHeaderMobileProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2 lg:hidden">
      {/* Le rôle est porté par le conteneur lui-même : un `display:contents`
          intermédiaire disparaît de l'arbre d'accessibilité de certains moteurs. */}
      {isDayScope(scope) ? (
        <div className={TRACK}>
          {/* Le mobile n'avait aucun chemin vers « Demain » : le voici. */}
          <ScopeSegment scope="today" active={scope === 'today'} count={dayCounts.today} />
          <ScopeSegment
            scope="tomorrow"
            active={scope === 'tomorrow'}
            count={dayCounts.tomorrow}
          />
        </div>
      ) : (
        <div role="radiogroup" aria-label="Compartiment de date" className={TRACK}>
          <button
            type="button"
            role="radio"
            aria-checked={bucket === 'dated'}
            onClick={() => onBucketChange('dated')}
            className={segmentClass(bucket === 'dated')}
          >
            Daté {bucketCounts.dated}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={bucket === 'undated'}
            onClick={() => onBucketChange('undated')}
            className={segmentClass(bucket === 'undated')}
          >
            Sans date {bucketCounts.undated}
          </button>
        </div>
      )}

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

/** La piste du segmenté : pleine largeur, fond `canvas`, segment actif en blanc. */
const TRACK = 'flex min-w-0 flex-1 rounded-[11px] bg-canvas p-[3px]'

function segmentClass(active: boolean) {
  return cn(
    'flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 py-[9px]',
    'text-[12.5px] whitespace-nowrap transition-colors duration-150',
    'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
    active
      ? 'bg-surface font-semibold text-primary shadow-[0_1px_3px_rgb(23_24_31/0.12)]'
      : 'font-medium text-ink-faint',
  )
}

/** Changer de portée est une navigation : un lien, comme en desktop. */
function ScopeSegment({
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
      className={segmentClass(active)}
    >
      {SCOPE_NAV_LABELS[scope]} {count}
    </Link>
  )
}
