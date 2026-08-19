import { Link, useLocation } from 'react-router'
import { selectTaskLists, useLists } from '../../hooks/useLists'
import { cn } from '../../lib/cn'
import { DEFAULT_LIST_COLOR } from '../../lib/listPalette'

// Sous-navigation de l'entrée « Tâches » : uniquement les listes. Les quatre
// portées (aujourd'hui, semaine, sans date, toutes) vivent dans l'en-tête de
// l'écran Tâches, les répéter ici donnait deux commandes pour un même choix.
// Elle vit dans `layout/`, donc elle **n'importe rien** de `features/tasks/` :
// elle se contente de pointer des URL, que l'écran Tâches sait interpréter.
// « Gérer les listes » ouvre la modale par le même chemin (`?listes=1`).
const ITEM =
  'flex items-center gap-2 rounded-sm px-2.5 py-[7px] text-[12px] transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-primary/32'

export function SidebarTaskSubnav() {
  const location = useLocation()
  // Les aide-mémoire ne paraissent pas ici : ils vivent dans leur widget
  // d'accueil, pas dans un écran fait pour ce qui a une échéance.
  const lists = selectTaskLists(useLists().data)

  // `NavLink` ignore la query string dans son `isActive` : toutes les entrées
  // seraient actives en même temps. On compare donc nous-mêmes.
  const onTasks = location.pathname === '/taches'
  const currentList = new URLSearchParams(location.search).get('liste')

  return (
    <div className="flex flex-col gap-px pt-0.5 pb-1.5 pl-6.5">
      {lists.map((list) => {
        const active = onTasks && currentList === list.id
        return (
          <Link
            key={list.id}
            to={{ pathname: '/taches', search: `?liste=${encodeURIComponent(list.id)}` }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              ITEM,
              active
                ? 'bg-primary-soft font-semibold text-primary'
                : 'text-ink-2 hover:bg-surface-subtle hover:text-ink',
            )}
          >
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: list.color ?? DEFAULT_LIST_COLOR }}
            />
            <span className="truncate">{list.name}</span>
          </Link>
        )
      })}

      <Link
        to={{ pathname: '/taches', search: '?listes=1' }}
        className={cn(ITEM, 'text-[11.5px] text-ink-muted hover:text-primary')}
      >
        ✎ Gérer les listes
      </Link>
    </div>
  )
}
