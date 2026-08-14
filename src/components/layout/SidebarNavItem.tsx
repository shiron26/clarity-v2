import { NavLink } from 'react-router'
import { cn } from '../../lib/cn'
import type { NavItem } from './navItems'

type SidebarNavItemProps = NavItem & {
  /** Compteur affiché à droite (tâches à traiter). Masqué si 0. */
  badge?: number
}

export function SidebarNavItem({ to, label, Icon, badge }: SidebarNavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-ui transition-colors duration-150',
          'outline-none focus-visible:ring-3 focus-visible:ring-primary/32',
          isActive
            ? 'bg-primary-soft font-medium text-primary'
            : 'text-ink-3 hover:bg-surface-subtle hover:text-ink',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
      {!!badge && (
        <span className="ml-auto rounded-2xl bg-primary px-2 py-0.5 text-caption font-bold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  )
}
