import { useMemo, useState } from 'react'
import { RitualOverlay } from '../../../components/ritual/RitualOverlay'
import { DeckRecap } from '../../../components/ritual/DeckRecap'
import { Alert } from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Spinner'
import { RitualRepair } from './RitualRepair'
import { RitualTriage } from './RitualTriage'
import { RitualProjection } from './RitualProjection'
import { countsDetail, poolTasks, projectionLines, ritualCounts } from '../ritualContent'
import { useAppDayStart } from '../../../hooks/useAppToday'
import { groupByObjective, useMilestones, type Milestone } from '../../../hooks/useMilestones'
import { useToggleMilestone } from '../../../hooks/useMilestoneMutations'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useAddObjectiveEntry, useObjectiveEntriesRange } from '../../../hooks/useObjectiveEntries'
import { indexPeriods, sumDoneByObjective, useObjectivePeriodsFor } from '../../../hooks/useObjectivePeriods'
import { useObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import { useObjectiveRegularity } from '../../../hooks/useObjectiveRegularity'
import { regularityPercent } from '../../../lib/objectiveState'
import {
  useAddObjectiveSession,
  useObjectiveSessions,
  useRemoveObjectiveSession,
} from '../../../hooks/useObjectiveSessions'
import { useTasks } from '../../../hooks/useTasks'
import { useDeleteTask } from '../../../hooks/useTaskMutations'
import { useWeekTaskCount } from '../../../hooks/useWeekTaskCount'
import { useValidateReview } from '../../../hooks/useReviewMutations'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { periodYearFor } from '../../../lib/objectivePeriod'
import { anyLoading } from '../../../lib/queryLoading'
import { weekDatesLabel } from '../../../lib/reviewPeriod'
import {
  addDays,
  daysOfWeek,
  quarterOf,
  year as yearOf,
  type IsoDate,
} from '../../../lib/appDate'
import type { Objective } from '../../../hooks/useObjectives'
import type { Review } from '../../../hooks/useReview'

/** Les trois questions, puis ce que le rituel rend. */
const STEPS = ['recap', 'repair', 'triage', 'projection'] as const
const QUESTIONS = 3

type RitualFlowProps = {
  review: Review
  /** Lundi de la semaine passée en revue. */
  weekStart: IsoDate
  weekNo: number
  today: IsoDate
  objectives: Objective[]
  /** Sortie en cours de route : on revient d'où l'on venait, le hub. */
  onClose: () => void
  /** Sortie par la porte de la cérémonie, une fois la projection lue. */
  onFinish: () => void
}

/**
 * Le rituel hebdomadaire, en plein écran.
 *
 * Même patron que l'ancien flow de review, qui était déjà le bon : un tableau
 * d'étapes, un index en state local, aucune bibliothèque de machine à états et
 * aucune route. Ce qui change, c'est ce que les étapes font — on ne note plus,
 * on constate, on répare, on trie.
 *
 * **Trois questions, puis ce que le rituel rend.** Un quatrième écran demandait
 * de désigner les tâches de la semaine à venir : il n'apportait rien que l'écran
 * de tri ne fasse déjà en remettant simplement le backlog sous les yeux, et il
 * posait la même question deux fois de suite. Sa disparition a emporté avec elle
 * `task.planned_week`, dont il était le seul auteur.
 *
 * Le fetching vit ici et les decks sont muets : ils reçoivent des données déjà
 * formées et rendent des gestes. C'est ce qui garde quatre écrans lisibles.
 */
export function RitualFlow({
  review,
  weekStart,
  weekNo,
  today,
  objectives,
  onClose,
  onFinish,
}: RitualFlowProps) {
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const weekEnd = addDays(weekStart, 6)
  const weekDays = useMemo(() => daysOfWeek(weekStart), [weekStart])

  const objectiveIds = useMemo(() => objectives.map((o) => o.id), [objectives])
  const quantIds = useMemo(
    () => objectives.filter((o) => o.measure === 'quantite').map((o) => o.id),
    [objectives],
  )

  // Une semaine ne couvre qu'une année ISO — mais pas forcément celle du mois
  // qui la contient, d'où les deux ancres.
  const { periods: allPeriods, queries: periodQueries } = useObjectivePeriodsFor(
    objectives,
    [periodYearFor('week', weekStart)],
    periodYearFor('month', weekStart),
  )
  const activeDaysQuery = useObjectiveActiveDays(objectiveIds, weekStart, weekEnd)
  const sessionsQuery = useObjectiveSessions(objectiveIds, weekStart, weekEnd)
  const progressQuery = useObjectiveProgress(objectiveIds)
  const regularityQuery = useObjectiveRegularity(objectiveIds)
  const entriesQuery = useObjectiveEntriesRange(
    quantIds,
    `${yearOf(weekStart)}-01-01`,
    today,
  )
  const milestonesQuery = useMilestones(objectiveIds, yearOf(weekStart), quarterOf(weekStart))

  // Les tâches cochées de la semaine, pour le chiffre de l'écran 1.
  const countQuery = useWeekTaskCount(weekStart)

  const dayStartQuery = useAppDayStart()
  const tasksQuery = useTasks('all', { completedSince: dayStartQuery.data })

  const addSession = useAddObjectiveSession()
  const removeSession = useRemoveObjectiveSession()
  const addEntry = useAddObjectiveEntry()
  const toggleMilestone = useToggleMilestone()
  const deleteTask = useDeleteTask()
  const validateReview = useValidateReview()

  const periods = useMemo(() => indexPeriods(allPeriods), [allPeriods])
  const totals = useMemo(() => sumDoneByObjective(allPeriods), [allPeriods])
  const activeDays = useMemo(
    () => activeDaysQuery.data ?? new Set<string>(),
    [activeDaysQuery.data],
  )
  const sessions = useMemo(
    () => sessionsQuery.data ?? new Map<string, string>(),
    [sessionsQuery.data],
  )
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const progress = useMemo(() => progressQuery.data ?? new Map(), [progressQuery.data])
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )
  const counts = useMemo(
    () =>
      ritualCounts({
        objectives,
        periods,
        entries,
        weekStart,
        weekEnd,
        taskTotal: countQuery.data?.total ?? 0,
        taskLinked: countQuery.data?.linked ?? 0,
      }),
    [objectives, periods, entries, weekStart, weekEnd, countQuery.data],
  )

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])

  const pool = useMemo(() => poolTasks(tasks), [tasks])

  const lines = useMemo(
    () =>
      projectionLines({
        objectives,
        periods,
        allPeriods,
        totals,
        progress,
        entries,
        today,
      }),
    [objectives, periods, allPeriods, totals, progress, entries, today],
  )

  // Régularité agrégée : la somme des attendus, pas la moyenne des pourcentages
  // — sinon un objectif à 1 période close pèserait autant qu'un autre à 4.
  const { percent, projectedPercent } = useMemo(() => {
    let done = 0
    let target = 0
    let pDone = 0
    let pTarget = 0
    for (const objective of objectives) {
      const row = regularityQuery.data?.get(objective.id)
      if (!row) continue
      done += row.done
      target += row.target
      pDone += row.done_projected
      pTarget += row.target_projected
    }
    return {
      percent: regularityPercent(done, target),
      projectedPercent: regularityPercent(pDone, pTarget),
    }
  }, [objectives, regularityQuery.data])

  function handleToggleMilestone(milestone: Milestone) {
    toggleMilestone.mutate({ id: milestone.id, completed: milestone.completed_at === null })
  }

  // « Validée » signifie « le rituel a eu lieu » : avoir traversé les trois
  // questions suffit, on n'exige pas que tout ait été rempli.
  /**
   * Terminer, c'est écrire. Tant que la validation n'a pas abouti, la cérémonie
   * ne se déclare pas terminée : sinon un échec (réseau coupé, session expirée)
   * laissait `validated_at` nul, l'encart revenait à la visite suivante, et on
   * refaisait le même rituel sans jamais voir pourquoi. `validateReview.error`
   * est affichée par l'`Alert` du deck, d'où le `catch` muet.
   */
  function handleFinish() {
    if (review.validated_at !== null) {
      setStep(step + 1)
      return
    }
    validateReview
      .mutateAsync(review.id)
      .then(() => setStep(step + 1))
      .catch(() => {})
  }

  const writeError =
    addSession.error ??
    removeSession.error ??
    addEntry.error ??
    toggleMilestone.error ??
    deleteTask.error ??
    validateReview.error ??
    null

  const loading = anyLoading([
    ...periodQueries,
    activeDaysQuery,
    sessionsQuery,
    tasksQuery,
  ])

  const eyebrow = `Semaine ${weekNo} · ${weekDatesLabel(weekStart)}`

  return (
    <RitualOverlay
      label="Rituel de la semaine"
      step={current === 'projection' ? undefined : step + 1}
      total={current === 'projection' ? undefined : QUESTIONS}
      onClose={onClose}
    >
      {writeError && (
        <Alert variant="danger" className="mb-4 w-full text-left">
          {dataErrorMessage(writeError)}
        </Alert>
      )}

      {loading && current !== 'projection' ? (
        <Spinner className="text-ink-onnight" />
      ) : current === 'recap' ? (
        <DeckRecap
          eyebrow={eyebrow}
          count={counts.total}
          headline={
            counts.total === 1 ? 'chose faite cette semaine' : 'choses faites cette semaine'
          }
          detail={countsDetail(counts)}
          nextLabel="Continuer →"
          onNext={() => setStep(step + 1)}
        />
      ) : current === 'repair' ? (
        <RitualRepair
          eyebrow={`Semaine ${weekNo}`}
          objectives={objectives}
          periods={periods}
          milestonesByObjective={milestonesByObjective}
          progress={progress}
          weekDays={weekDays}
          weekStart={weekStart}
          activeDays={activeDays}
          sessions={sessions}
          today={today}
          savingEntry={addEntry.isPending}
          onAddSession={(objectiveId, day) => addSession.mutate({ objectiveId, day })}
          onRemoveSession={(id) => removeSession.mutate(id)}
          onAddEntry={(objectiveId, value) => addEntry.mutate({ objectiveId, value })}
          onToggleMilestone={handleToggleMilestone}
          onNext={() => setStep(step + 1)}
        />
      ) : current === 'triage' ? (
        <RitualTriage
          pool={pool}
          today={today}
          onDrop={(task) => deleteTask.mutate(task.id)}
          onFinish={handleFinish}
        />
      ) : (
        <RitualProjection
          lines={lines}
          regularity={percent}
          projected={projectedPercent}
          onClose={onFinish}
        />
      )}
    </RitualOverlay>
  )
}
