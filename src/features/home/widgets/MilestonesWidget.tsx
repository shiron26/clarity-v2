import { useMemo } from 'react'
import { Link } from 'react-router'
import { useObjectives } from '../../../hooks/useObjectives'
import { useMilestones, type Milestone } from '../../../hooks/useMilestones'
import { useToggleMilestone } from '../../../hooks/useMilestoneMutations'
import { firstLoadError } from '../../../hooks/useQueriesState'
import { isWithinWindow, weeksLeftInQuarter } from '../../../lib/objectiveFeasibility'
import { objectiveSkinOf, maskTitle } from '../../../lib/objectivePalette'
import { addDays, formatDayMonthLong, quarterOf, year as yearOf } from '../../../lib/appDate'
import { windowEnd } from '../../../lib/objectiveFeasibility'
import { useDashboardCtx } from '../dashboardContext'
import { MilestoneCheckRow } from '../../../components/objectives/MilestoneCheckRow'
import { WIDGET_GLYPH } from './glyphs'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * « Étapes en cours » — les jalons du trimestre, tous objectifs confondus.
 *
 * C'est la seule fenêtre du produit sur les objectifs SECONDAIRES : leur unique
 * mécanique est le jalon, et sans ce widget on ne les revoit qu'au bilan du
 * trimestre, c'est-à-dire trop tard pour agir.
 *
 * Le décompte en tête fait tout le travail : quatre étapes et six semaines, c'est
 * un plan ; quatre étapes et une semaine, c'est une décision à prendre. L'app
 * n'a pas à dire laquelle.
 */
export function MilestonesWidget() {
  const { today, privacy } = useDashboardCtx()
  const year = yearOf(today)
  const quarter = quarterOf(today)

  const objectivesQuery = useObjectives(year)
  // Principaux ET secondaires : ici les deux natures se valent, seul compte ce
  // qui court en ce moment.
  const objectives = useMemo(
    () =>
      (objectivesQuery.data ?? []).filter(
        (o) =>
          o.user_id !== null &&
          o.parent_objective_id === null &&
          o.closed_at === null &&
          isWithinWindow(o, today),
      ),
    [objectivesQuery.data, today],
  )
  const objectiveIds = useMemo(() => objectives.map((o) => o.id), [objectives])
  const milestonesQuery = useMilestones(objectiveIds, year, quarter)
  const toggleMilestone = useToggleMilestone()

  const groups = useMemo(() => {
    const byObjective = new Map<string, Milestone[]>()
    for (const milestone of milestonesQuery.data ?? []) {
      const bucket = byObjective.get(milestone.objective_id)
      if (bucket) bucket.push(milestone)
      else byObjective.set(milestone.objective_id, [milestone])
    }
    return objectives
      .map((objective) => ({ objective, milestones: byObjective.get(objective.id) ?? [] }))
      .filter((group) => group.milestones.length > 0)
  }, [milestonesQuery.data, objectives])

  const all = groups.flatMap((group) => group.milestones)
  const done = all.filter((m) => m.completed_at !== null).length
  const lastDay = addDays(windowEnd(year, quarter), -1)
  const weeksLeft = weeksLeftInQuarter(today, year, quarter)

  return (
    <WidgetCard
      title="Étapes en cours"
      icon={WIDGET_GLYPH['milestones']}
      meta={<span>jusqu’au {formatDayMonthLong(lastDay, today)}</span>}
      error={firstLoadError(objectivesQuery, milestonesQuery)}
      onRetry={() => void milestonesQuery.refetch()}
      retrying={milestonesQuery.isFetching}
    >
      {all.length === 0 ? (
        <>
          <WidgetEmpty>
            Aucune étape prévue d’ici le {formatDayMonthLong(lastDay, today)}.
          </WidgetEmpty>
          <Link
            to="/objectifs"
            className="mt-1 text-label font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Découper un objectif en étapes →
          </Link>
        </>
      ) : (
        <>
          <p className="-mt-1 mb-1 text-label text-ink-muted">
            {weeksLeft === 1 ? '1 semaine restante' : `${weeksLeft} semaines restantes`} ·{' '}
            {done} sur {all.length}
          </p>

          <div className="flex flex-col gap-2.5">
            {groups.map(({ objective, milestones }) => {
              const skin = objectiveSkinOf(objective)
              return (
                <div key={objective.id} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-2xl"
                      style={{ backgroundColor: skin.core }}
                    />
                    <span className="min-w-0 truncate text-label font-medium text-ink-2">
                      {privacy ? maskTitle(objective.title) : objective.title}
                    </span>
                  </div>

                  <div className="mt-0.5 pl-3.5">
                    {milestones.map((milestone) => (
                      <MilestoneCheckRow
                        key={milestone.id}
                        milestone={milestone}
                        accent={skin.core}
                        privacy={privacy}
                        onToggle={(m) =>
                          toggleMilestone.mutate({
                            id: m.id,
                            completed: m.completed_at === null,
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </WidgetCard>
  )
}
