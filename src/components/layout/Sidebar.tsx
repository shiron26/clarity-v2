import { Fragment } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { useAppToday } from '../../hooks/useAppToday'
import { useProfile } from '../../hooks/useProfile'
import { useTasks } from '../../hooks/useTasks'
import { Logo } from '../brand/Logo'
import { GearIcon } from '../icons/GearIcon'
import { LogoutIcon } from '../icons/LogoutIcon'
import { Avatar } from '../ui/Avatar'
import { NAV_ITEMS } from './navItems'
import { SidebarNavItem } from './SidebarNavItem'
import { SidebarTaskSubnav } from './SidebarTaskSubnav'

export function Sidebar() {
  const { signOut } = useAuth()
  const profile = useProfile()
  const displayName = profile.data?.display_name?.trim() || 'Mon compte'

  // Badge « Tâches » : ce qui reste à traiter aujourd'hui, retards compris.
  const today = useAppToday().data
  const todayTasks = useTasks('today', { today })
  const overdueTasks = useTasks('overdue', { today })
  const pending =
    (todayTasks.data ?? []).filter((t) => t.completed_at === null).length +
    (overdueTasks.data ?? []).length

  return (
    <nav
      aria-label="Navigation principale"
      className="hidden w-[228px] shrink-0 flex-col gap-0.5 border-r border-border bg-surface-sidebar px-3.5 pt-5.5 pb-4.5 lg:flex"
    >
      <Logo size="sm" className="px-2.5 pb-4.5" />

      {NAV_ITEMS.map((item) => (
        <Fragment key={item.to}>
          <SidebarNavItem {...item} badge={item.to === '/taches' ? pending : undefined} />
          {item.to === '/taches' && <SidebarTaskSubnav />}
        </Fragment>
      ))}

      <button
        type="button"
        disabled
        title="Les réglages arriveront avec les pages de configuration"
        className="mt-auto flex cursor-default items-center gap-2.5 rounded-md px-3 py-2.5 text-ui text-ink-muted"
      >
        <GearIcon className="size-4 shrink-0" />
        Réglages
      </button>

      <div className="mt-3.5 flex items-center gap-2.5 border-t border-border px-2 pt-3.5">
        <Avatar name={profile.data?.display_name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold">{displayName}</div>
          <div className="text-[10px] text-ink-muted">Espace personnel</div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:bg-danger-bg hover:text-danger focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <LogoutIcon />
        </button>
      </div>
    </nav>
  )
}
