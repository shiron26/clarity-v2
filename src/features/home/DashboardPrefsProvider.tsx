import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { DashboardPrefsContext, type DashboardPrefsValue } from './DashboardPrefsContext'
import { DEFAULT_PREFS, readPrefs, writePrefs, type DashboardPrefs } from './dashboardPrefs'

export function DashboardPrefsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  // Lecture paresseuse : un seul accès au localStorage au montage.
  const [prefs, setPrefs] = useState<DashboardPrefs>(() =>
    userId ? readPrefs(userId) : DEFAULT_PREFS,
  )

  const setPref = useCallback<DashboardPrefsValue['setPref']>(
    (key, value) => {
      setPrefs((current) => {
        const next = { ...current, [key]: value }
        if (userId) writePrefs(userId, next)
        return next
      })
    },
    [userId],
  )

  const togglePref = useCallback<DashboardPrefsValue['togglePref']>(
    (key) => {
      setPrefs((current) => {
        const next = { ...current, [key]: !current[key] }
        if (userId) writePrefs(userId, next)
        return next
      })
    },
    [userId],
  )

  const value = useMemo(() => ({ prefs, setPref, togglePref }), [prefs, setPref, togglePref])

  return <DashboardPrefsContext value={value}>{children}</DashboardPrefsContext>
}
