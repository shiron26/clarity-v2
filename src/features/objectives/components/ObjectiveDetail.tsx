import { useState } from 'react'
import { cn } from '../../../lib/cn'
import { CheckIcon } from '../../../components/icons/CheckIcon'
import { Alert } from '../../../components/ui/Alert'
import { ObjectiveHeatmap } from '../../../components/objectives/ObjectiveHeatmap'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveWeek } from '../../../hooks/useObjectiveWeeks'
import type { QuarterRatings } from '../../../hooks/useQuarterRatings'
import { useCloseObjective } from '../../../hooks/useObjectiveMutations'
import { maskTitle, objectiveSkin } from '../../../lib/objectivePalette'
import { dataErrorMessage } from '../../../lib/errorMessage'
import type { IsoDate, WeekRef } from '../../../lib/appDate'
import { CadenceStrip } from './CadenceStrip'
import { MilestoneList } from './MilestoneList'
import { ObjectiveCelebration } from './ObjectiveCelebration'
import { TrendBadge } from './TrendBadge'
import { cadenceLabel } from '../objectiveDisplay'

const SECONDARY_GRADIENT = 'linear-gradient(150deg,#3f414d,#5a5c6b)'

type ObjectiveDetailProps = {
  objective: Objective
  /** Relevés de l'année ISO, tous objectifs confondus. */
  weekIndex: Map<string, ObjectiveWeek>
  /** Relevés du seul objectif affiché, dans l'ordre des semaines de la heatmap. */
  objectiveWeeks: ObjectiveWeek[]
  activeDays: Set<string>
  weekDays: IsoDate[]
  /** Lundis des 13 dernières semaines. */
  heatmapWeeks: IsoDate[]
  monthLabels: string[]
  quarterWeeks: WeekRef[]
  ratings: QuarterRatings
  milestones: Milestone[]
  quarter: number
  today: IsoDate
  currentWeekNo: number
  privacy?: boolean
  readOnly?: boolean
  onEdit: () => void
}

export function ObjectiveDetail({
  objective,
  weekIndex,
  objectiveWeeks,
  activeDays,
  weekDays,
  heatmapWeeks,
  monthLabels,
  quarterWeeks,
  ratings,
  milestones,
  quarter,
  today,
  currentWeekNo,
  privacy = false,
  readOnly = false,
  onEdit,
}: ObjectiveDetailProps) {
  const closeObjective = useCloseObjective()
  const [celebrating, setCelebrating] = useState(false)

  const skin = objectiveSkin(objective.slot)
  const isPrincipal = objective.kind === 'principal'
  const reached = objective.closed_at !== null
  const title = privacy ? maskTitle(objective.title) : objective.title

  // Un secondaire n'a ni cadence, ni relevé hebdomadaire, ni tâches : les jalons
  // sont sa seule mécanique (SPEC §3). Tout le bloc de régularité disparaît.
  const showCadence = isPrincipal && !reached
  const sub = isPrincipal ? cadenceLabel(objective.cadence) : objective.description

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="border-b border-surface-subtle px-5.5 pt-4 pb-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{
              backgroundImage: isPrincipal ? skin.gradient : SECONDARY_GRADIENT,
              boxShadow: isPrincipal ? `0 0 10px ${skin.ramp[1]}66` : undefined,
            }}
          />
          <h2 className="min-w-0 flex-1 text-card font-semibold">{title}</h2>

          {!readOnly && (
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={onEdit}
                className="flex flex-1 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-3.5 py-2 text-[11.5px] font-medium text-ink-2 transition-colors duration-150 hover:border-border-strong hover:text-ink sm:flex-none"
              >
                ✎ Modifier
              </button>

              {isPrincipal && (
                <button
                  type="button"
                  onClick={() =>
                    closeObjective.mutate(
                      { id: objective.id, closed: !reached },
                      // On ne célèbre qu'une clôture : rouvrir ne déclenche rien.
                      { onSuccess: () => !reached && setCelebrating(true) },
                    )
                  }
                  disabled={closeObjective.isPending}
                  className={cn(
                    'flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3.5 py-2 text-[11.5px] font-medium whitespace-nowrap transition-colors duration-150 sm:flex-none',
                    reached
                      ? 'border-[#b7e4c7] bg-[#eef8f0] text-[#0d7a45]'
                      : 'border-border bg-surface text-ink-2 hover:border-border-strong',
                  )}
                >
                  {reached ? '↺ Rouvrir' : '✓ Marquer comme terminé'}
                </button>
              )}
            </div>
          )}
        </div>

        {sub && (
          <div className="mt-2.5 pl-6">
            <span className="rounded-2xl border border-border bg-field px-2.5 py-[3px] text-[10.5px] font-medium text-ink-2">
              {privacy && !isPrincipal ? '•••' : sub}
            </span>
          </div>
        )}

        {closeObjective.error && (
          <Alert className="mt-3">{dataErrorMessage(closeObjective.error)}</Alert>
        )}
      </div>

      {reached && (
        <div className="flex items-center gap-3 border-b border-surface-subtle bg-[#eef8f0] px-5.5 py-4">
          <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-[#12b76a] text-white">
            <CheckIcon className="size-3.5" />
          </span>
          <span className="text-body font-semibold text-[#0d7a45]">Objectif atteint</span>
        </div>
      )}

      {showCadence && (
        <>
          <CadenceStrip
            objective={objective}
            week={weekIndex.get(`${objective.id}|${currentWeekNo}`)}
            activeDays={activeDays}
            weekDays={weekDays}
            quarterWeeks={quarterWeeks}
            ratings={ratings}
            quarter={quarter}
          />

          <div className="grid gap-7 bg-night px-5.5 py-5 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0">
              <h3 className="mb-1.5 text-[10px] font-semibold tracking-[1.3px] text-[#7c8097]">
                RÉGULARITÉ · Q{quarter}
              </h3>
              <p className="mb-3.5 text-[10.5px] leading-relaxed text-[#565866]">
                Une case s’allume quand une séance est faite ce jour
                <span className="hidden sm:inline"> · une colonne encadrée = semaine réussie</span>
              </p>

              <ObjectiveHeatmap
                objective={objective}
                weeks={heatmapWeeks}
                weekIndex={weekIndex}
                activeDays={activeDays}
                today={today}
                privacy={privacy}
                showDayLabels
                showHeader={false}
              />

              <div className="mt-3 flex gap-6 text-[8.5px] text-[#565866]">
                {monthLabels.map((month, i) => (
                  <span
                    key={`${month}-${i}`}
                    className={cn(i === monthLabels.length - 1 && 'font-semibold text-[#9aa0b5]')}
                  >
                    {month}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <TrendBadge weeks={objectiveWeeks} />
            </div>
          </div>
        </>
      )}

      <MilestoneList
        objective={objective}
        milestones={milestones}
        quarter={quarter}
        privacy={privacy}
        readOnly={readOnly}
      />

      {celebrating && (
        <ObjectiveCelebration
          objective={objective}
          week={weekIndex.get(`${objective.id}|${currentWeekNo}`)}
          activeDays={activeDays}
          milestones={milestones}
          weekDays={weekDays}
          today={today}
          onClose={() => setCelebrating(false)}
        />
      )}
    </div>
  )
}
