import { useContext } from 'react'
import { DashboardPrefsContext } from './DashboardPrefsContext'

export function useDashboardPrefs() {
  const value = useContext(DashboardPrefsContext)
  if (!value) {
    throw new Error('useDashboardPrefs doit être utilisé sous <DashboardPrefsProvider>')
  }
  return value
}
