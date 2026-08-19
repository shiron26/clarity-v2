import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { DashboardLayoutContext, type DashboardLayoutValue } from './DashboardLayoutContext'
import {
  DEFAULT_LAYOUT,
  newWidgetKey,
  readLayout,
  writeLayout,
  type DashboardLayout,
} from './dashboardLayout'
import { widgetDef } from './widgets/registry'

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  // Lecture paresseuse : un seul accès au localStorage au montage.
  const [layout, setLayout] = useState<DashboardLayout>(() =>
    userId ? readLayout(userId) : DEFAULT_LAYOUT,
  )

  // Toute écriture passe par ici : l'état et le stockage ne peuvent pas diverger.
  const update = useCallback(
    (next: (current: DashboardLayout) => DashboardLayout) => {
      setLayout((current) => {
        const value = next(current)
        if (userId) writeLayout(userId, value)
        return value
      })
    },
    [userId],
  )

  const addWidget = useCallback<DashboardLayoutValue['addWidget']>(
    (id, memo) => {
      update((current) => [
        ...current,
        { key: newWidgetKey(), id, span: widgetDef(id).defaultSpan, ...(memo ? { memo } : {}) },
      ])
    },
    [update],
  )

  const removeWidget = useCallback<DashboardLayoutValue['removeWidget']>(
    (key) => update((current) => current.filter((widget) => widget.key !== key)),
    [update],
  )

  const setSpan = useCallback<DashboardLayoutValue['setSpan']>(
    (key, span) =>
      update((current) =>
        current.map((widget) => (widget.key === key ? { ...widget, span } : widget)),
      ),
    [update],
  )

  const setOrder = useCallback<DashboardLayoutValue['setOrder']>(
    (orderedKeys) =>
      update((current) => {
        const byKey = new Map(current.map((widget) => [widget.key, widget]))
        // Les clés inconnues sont ignorées, les manquantes gardent leur place à
        // la fin : le glissement ne peut pas perdre un widget en route.
        const ordered = orderedKeys
          .map((key) => byKey.get(key))
          .filter((widget): widget is (typeof current)[number] => widget !== undefined)
        const seen = new Set(ordered.map((widget) => widget.key))
        return [...ordered, ...current.filter((widget) => !seen.has(widget.key))]
      }),
    [update],
  )

  const reset = useCallback(() => update(() => DEFAULT_LAYOUT), [update])

  const value = useMemo(
    () => ({ layout, addWidget, removeWidget, setSpan, setOrder, reset }),
    [layout, addWidget, removeWidget, setSpan, setOrder, reset],
  )

  return <DashboardLayoutContext value={value}>{children}</DashboardLayoutContext>
}
