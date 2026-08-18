import type { ComponentType, SVGProps } from 'react'
import { DashboardIcon } from '../icons/DashboardIcon'
import { ObjectivesIcon } from '../icons/ObjectivesIcon'
import { ReviewIcon } from '../icons/ReviewIcon'
import { TasksIcon } from '../icons/TasksIcon'
import { YearIcon } from '../icons/YearIcon'

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
  { to: '/annee', label: 'Année', Icon: YearIcon },
  { to: '/review', label: 'Rituel', Icon: ReviewIcon },
]

/**
 * La barre d'onglets mobile n'en tient que quatre, le FAB occupant le centre —
 * et « Rituel » est celui qui cède la place. Il s'ouvre de toute façon depuis
 * son encart sur le dashboard, alors que l'écran Année n'a pas d'autre porte.
 * Une liste explicite, jamais un `slice` : l'ordre de `NAV_ITEMS` sert la
 * sidebar, il ne doit pas décider en douce du contenu de la barre.
 */
export const MOBILE_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.to !== '/review',
)
