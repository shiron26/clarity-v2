import { useMemo } from 'react'
import { useObjectives, selectPrincipals } from '../../../hooks/useObjectives'
import { isWithinWindow } from '../../../lib/objectiveFeasibility'
import { formatDayMonthLong, year as yearOf } from '../../../lib/appDate'
import { useDashboardCtx } from '../dashboardContext'
import { WIDGET_GLYPH } from './glyphs'
import { WidgetCard } from './WidgetCard'
import { horizonState } from './horizon'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/**
 * « L'horizon » — l'année, la position du jour, et la date à laquelle la fenêtre
 * en cours se referme.
 *
 * Le trait d'aujourd'hui est orange (`bg-today`) et non bleu : le bleu ne
 * signale qu'une action, jamais un repère.
 */
export function HorizonWidget() {
  const { today } = useDashboardCtx()
  const objectivesQuery = useObjectives(yearOf(today))

  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data).filter((o) => isWithinWindow(o, today)),
    [objectivesQuery.data, today],
  )
  const state = useMemo(() => horizonState(principals, today), [principals, today])

  const { nearest } = state
  const sentence = !nearest
    ? `Il reste ${state.weeksLeftInYear} semaines en ${yearOf(today)}.`
    : nearest.shared
      ? `${objectiveCount(nearest.count)} ${nearest.count > 1 ? 'courent' : 'court'} jusqu’au ${formatDayMonthLong(nearest.lastDay, today)}. Il reste ${weeks(nearest.weeksLeft)}.`
      : `Le plus proche se termine le ${formatDayMonthLong(nearest.lastDay, today)}, dans ${weeks(nearest.weeksLeft)}.`

  return (
    <WidgetCard
      title={String(yearOf(today))}
      icon={WIDGET_GLYPH['horizon']}
      meta={<span>{formatDayMonthLong(today)}</span>}
      error={objectivesQuery.error}
      onRetry={() => void objectivesQuery.refetch()}
      retrying={objectivesQuery.isFetching}
    >
      <div className="relative mt-1 h-3 overflow-hidden rounded-2xl bg-field">
        <div
          className="h-full rounded-2xl bg-ink-muted/45"
          style={{ width: `${state.progress}%` }}
        />
        {[25, 50, 75].map((mark) => (
          <span
            key={mark}
            aria-hidden
            className="absolute inset-y-0 w-px bg-surface"
            style={{ left: `${mark}%` }}
          />
        ))}
        <span
          aria-hidden
          className="absolute inset-y-0 w-0.5 rounded-2xl bg-today"
          style={{ left: `calc(${state.progress}% - 1px)` }}
        />
      </div>

      <div aria-hidden className="mt-1.5 grid grid-cols-12 text-center text-micro text-ink-muted">
        {MONTHS.map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>

      <p className="mt-3 text-body text-ink-2">{sentence}</p>
    </WidgetCard>
  )
}

function objectiveCount(count: number): string {
  return count === 1 ? 'Votre objectif' : `Vos ${count} objectifs`
}

function weeks(count: number): string {
  return count === 1 ? '1 semaine' : `${count} semaines`
}
