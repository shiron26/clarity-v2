import { NavLink } from 'react-router'
import { useNewTask } from '../../hooks/useNewTask'
import { cn } from '../../lib/cn'
import { PlusIcon } from '../icons/PlusIcon'
import { NAV_ITEMS } from './navItems'

export function MobileTabBar() {
  const [dashboard, tasks, objectives, review] = NAV_ITEMS
  const { openNewTask } = useNewTask()

  const tab = ({ to, label, Icon }: (typeof NAV_ITEMS)[number]) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150',
          'outline-none focus-visible:ring-3 focus-visible:ring-primary/32',
          isActive ? 'font-semibold text-primary' : 'font-medium text-ink-muted',
        )
      }
    >
      <Icon />
      {label}
    </NavLink>
  )

  return (
    <nav
      aria-label="Navigation principale"
      // Sans zone sûre, les onglets passent sous l'indicateur d'accueil en app
      // installée (index.html porte viewport-fit=cover). `max()` et non `calc(+)` :
      // en navigateur env() vaut 0 et on retrouve exactement les pb-5 d'origine,
      // en standalone iOS on obtient 34 px — le dégagement, sans épaissir la barre.
      className="shrink-0 border-t border-border bg-surface-sidebar px-2.5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="grid grid-cols-[1fr_1fr_60px_1fr_1fr] items-center">
        {tab(dashboard!)}
        {tab(tasks!)}
        {/* Une action, pas une navigation : la modale s'ouvre par-dessus l'écran
            courant, comme le raccourci « N ». La barre reste découplée de
            `features/tasks/` — elle passe par le hook transverse. */}
        <button
          type="button"
          onClick={openNewTask}
          aria-label="Nouvelle tâche"
          className="bg-brand-gradient relative -top-[22px] flex size-[54px] cursor-pointer items-center justify-center justify-self-center rounded-full text-white shadow-fab outline-none focus-visible:ring-3 focus-visible:ring-primary/32"
        >
          <PlusIcon className="size-6" />
        </button>
        {tab(objectives!)}
        {tab(review!)}
      </div>
    </nav>
  )
}
