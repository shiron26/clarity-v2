import type { ComponentType, SVGProps } from 'react'
import { DashboardIcon } from '../icons/DashboardIcon'
import { ObjectivesIcon } from '../icons/ObjectivesIcon'
import { ReviewIcon } from '../icons/ReviewIcon'
import { TasksIcon } from '../icons/TasksIcon'

export type NavItem = {
  to: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Source unique de la navigation : sidebar desktop et barre d'onglets mobile.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: DashboardIcon },
  { to: '/taches', label: 'Tâches', Icon: TasksIcon },
  { to: '/objectifs', label: 'Objectifs', Icon: ObjectivesIcon },
  { to: '/review', label: 'Review', Icon: ReviewIcon },
]
