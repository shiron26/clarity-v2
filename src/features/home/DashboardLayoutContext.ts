import { createContext } from 'react'
import type { DashboardLayout, MemoKind, WidgetId, WidgetSpan } from './dashboardLayout'

export type DashboardLayoutValue = {
  layout: DashboardLayout
  addWidget: (id: WidgetId, memo?: MemoKind) => void
  removeWidget: (key: string) => void
  setSpan: (key: string, span: WidgetSpan) => void
  setOrder: (orderedKeys: string[]) => void
  reset: () => void
}

export const DashboardLayoutContext = createContext<DashboardLayoutValue | null>(null)
