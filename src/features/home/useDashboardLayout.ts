import { useContext } from 'react'
import { DashboardLayoutContext } from './DashboardLayoutContext'

export function useDashboardLayout() {
  const value = useContext(DashboardLayoutContext)
  if (!value) {
    throw new Error('useDashboardLayout doit être utilisé sous <DashboardLayoutProvider>')
  }
  return value
}
