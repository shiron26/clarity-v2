import { createContext } from 'react'
import type { DashboardPrefs } from './dashboardPrefs'

export type DashboardPrefsValue = {
  prefs: DashboardPrefs
  setPref: <K extends keyof DashboardPrefs>(key: K, value: DashboardPrefs[K]) => void
  togglePref: (key: keyof DashboardPrefs) => void
}

export const DashboardPrefsContext = createContext<DashboardPrefsValue | null>(null)
