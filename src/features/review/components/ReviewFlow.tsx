import { useEffect, useMemo, useState } from 'react'
import { ReviewFlowBands } from './ReviewFlowBands'
import { ReviewFlowRating } from './ReviewFlowRating'
import { ReviewFlowRecap } from './ReviewFlowRecap'
import { Spinner } from '../../../components/ui/Spinner'
import { Alert } from '../../../components/ui/Alert'
import { useMilestones } from '../../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { indexWeeks, useObjectiveWeeks } from '../../../hooks/useObjectiveWeeks'
import { quarterRatingKey, useQuarterRatings } from '../../../hooks/useQuarterRatings'
import { useReview, useReviewItems, type PeriodRef } from '../../../hooks/useReview'
import { useRateObjective, useValidateReview } from '../../../hooks/useReviewMutations'
import { useWeekTaskCount } from '../../../hooks/useWeekTaskCount'
import { usePrefersReducedMotion } from '../../../hooks/usePrefersReducedMotion'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { addDays, daysOfWeek, isoWeek, type IsoDate, type WeekRef } from '../../../lib/appDate'
import type { Rating } from '../../../lib/reviewRating'
import type { Objective } from '../../../hooks/useObjectives'
import { weekDatesLabel, weekTitle } from '../reviewPeriod'

const CLOSE_MS = 430

type ReviewFlowProps = {
  period: PeriodRef
  /** Lundi de la semaine mise en avant — l'ancre des faits affichés. */
  weekStart: IsoDate
  weekNo: number
  currentWeekNo: number | undefined
  quarter: number
  quarterWeeks: WeekRef[]
  objectives: Objective[]
  onClose: () => void
}

/**
 * Le rituel, en plein écran.
 *
 * Trois temps en hebdo (ce que j'ai fait → ma régularité → mon jugement), deux
 * au bilan trimestriel : c'est le même écran paramétré (SPEC §3), seule change
 * la matière qu'il présente avant la notation.
 *
 * Il couvre l'application entière, sidebar comprise : pendant deux minutes,
 * il n'y a rien d'autre à faire.
 */
export function ReviewFlow({
  period,
  weekStart,
  weekNo,
  currentWeekNo,
  quarter,
  quarterWeeks,
  objectives,
  onClose,
}: ReviewFlowProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [step, setStep] = useState(0)
  const [goalIndex, setGoalIndex] = useState(0)
  const [closing, setClosing] = useState(false)

  const weekly = period.type === 'week'
  const objectiveIds = useMemo(() => objectives.map((o) => o.id), [objectives])

  const reviewQuery = useReview(period)
  const review = reviewQuery.data ?? undefined
  const itemsQuery = useReviewItems(review?.id)
  const items = itemsQuery.data

  const weeksQuery = useObjectiveWeeks(objectiveIds, isoWeek(weekStart).isoYear)
  const weekIndex = useMemo(() => indexWeeks(weeksQuery.data), [weeksQuery.data])
  const activeDaysQuery = useObjectiveActiveDays(
    objectiveIds,
    weekStart,
    addDays(weekStart, 6),
  )
  const countQuery = useWeekTaskCount(weekly ? weekStart : undefined)
  const milestonesQuery = useMilestones(
    weekly ? [] : objectiveIds,
    period.year,
    weekly ? undefined : quarter,
  )
  const ratingsQuery = useQuarterRatings(objectiveIds, quarterWeeks, quarter)
  const ratings = ratingsQuery.data

  const rateObjective = useRateObjective()
  const validateReview = useValidateReview()

  const steps = weekly ? ['recap', 'bands', 'rating'] : ['recap', 'rating']
  const current = steps[step]

  function handleClose() {
    if (closing) return
    if (reducedMotion) {
      onClose()
      return
    }
    setClosing(true)
    setTimeout(onClose, CLOSE_MS)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const objective = objectives[goalIndex]
  const item = objective && items ? items.get(objective.id) : undefined

  // Chaque geste n'envoie que son propre champ : cliquer une fusée ne doit pas
  // réécrire le commentaire, et inversement (les deux se suivent de près quand
  // on tape puis qu'on clique).
  function handleRate(rating: Rating) {
    if (!review || !objective) return
    rateObjective.mutate({
      reviewId: review.id,
      objectiveId: objective.id,
      itemId: item?.id,
      patch: { rating },
    })
  }

  function handleComment(comment: string) {
    if (!review || !objective) return
    rateObjective.mutate({
      reviewId: review.id,
      objectiveId: objective.id,
      itemId: item?.id,
      patch: { comment: comment.trim() === '' ? null : comment },
    })
  }

  function handleNextGoal() {
    if (goalIndex < objectives.length - 1) {
      setGoalIndex(goalIndex + 1)
      return
    }
    // Dernier objectif : « validée » signifie « le rituel a eu lieu » (SPEC §4.4).
    if (review) validateReview.mutate(review.id)
    handleClose()
  }

  const eyebrow = weekly
    ? `${weekTitle(weekNo, currentWeekNo)} · ${weekDatesLabel(weekStart)}`
    : `Bilan Q${quarter} · ${period.year}`

  const milestones = milestonesQuery.data ?? []
  const milestonesDone = milestones.filter((m) => m.completed_at !== null).length
  const ratedWeeks = quarterWeeks.filter((w) =>
    objectiveIds.some(
      (id) => ratings?.get(quarterRatingKey(id, w.isoYear, w.weekNo)) !== undefined,
    ),
  ).length

  const pending = reviewQuery.isPending || (review !== undefined && itemsQuery.isPending)
  const loadError =
    reviewQuery.error ??
    itemsQuery.error ??
    rateObjective.error ??
    validateReview.error ??
    null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={weekly ? 'Review de la semaine' : `Bilan du trimestre ${quarter}`}
      className={cn(
        'fixed inset-0 z-60 flex flex-col overflow-y-auto px-5 pt-6.5 pb-4 lg:px-11 lg:pt-7.5 lg:pb-4.5',
        'bg-[radial-gradient(1100px_600px_at_50%_-10%,#1d2030,#101116_60%)]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      {loadError && (
        <Alert variant="danger" className="mx-auto mb-3 max-w-160">
          {dataErrorMessage(loadError)}
        </Alert>
      )}

      {pending ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="text-ink-onnight" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-title font-semibold text-white">Rien à noter cette fois</p>
          <p className="max-w-100 text-body text-ink-onnight">
            Aucun objectif n’était ouvert sur cette période.
          </p>
        </div>
      ) : current === 'recap' ? (
        <ReviewFlowRecap
          eyebrow={eyebrow}
          count={weekly ? (countQuery.data?.total ?? 0) : milestonesDone}
          headline={
            weekly ? 'tâches accomplies cette semaine' : 'jalons atteints ce trimestre'
          }
          detail={
            weekly
              ? `dont ${countQuery.data?.linked ?? 0} liée${(countQuery.data?.linked ?? 0) > 1 ? 's' : ''} à vos objectifs`
              : `sur ${milestones.length} posé${milestones.length > 1 ? 's' : ''} · ${ratedWeeks} semaine${ratedWeeks > 1 ? 's' : ''} notée${ratedWeeks > 1 ? 's' : ''}`
          }
          nextLabel={weekly ? 'Continuer →' : 'Noter mes objectifs →'}
          onNext={() => setStep(step + 1)}
        />
      ) : current === 'bands' ? (
        <ReviewFlowBands
          title={weekTitle(weekNo, currentWeekNo)}
          objectives={objectives}
          weekIndex={weekIndex}
          weekNo={weekNo}
          activeDays={activeDaysQuery.data ?? new Set<string>()}
          weekDays={daysOfWeek(weekStart)}
          onNext={() => setStep(step + 1)}
        />
      ) : (
        objective && (
          <ReviewFlowRating
            key={objective.id}
            objective={objective}
            index={goalIndex}
            total={objectives.length}
            rating={item?.rating ?? null}
            comment={item?.comment ?? ''}
            cells={weekly ? cellsFor(objective, weekIndex, weekNo, activeDaysQuery.data, weekStart) : null}
            daily={(weekIndex.get(`${objective.id}|${weekNo}`)?.cadence_target ?? objective.cadence) === 7}
            stat={
              weekly
                ? statFor(objective, weekIndex, weekNo)
                : `${ratedWeeks}/${quarterWeeks.length} semaines notées`
            }
            sparkline={quarterWeeks.map((w) =>
              ratings?.get(quarterRatingKey(objective.id, w.isoYear, w.weekNo)),
            )}
            quarter={quarter}
            nextLabel={
              goalIndex < objectives.length - 1 ? 'Objectif suivant →' : 'Valider ma review ✓'
            }
            hasPrev={goalIndex > 0}
            onRate={handleRate}
            onCommentCommit={handleComment}
            onPrev={() => setGoalIndex(goalIndex - 1)}
            onNext={handleNextGoal}
          />
        )
      )}

      <div className="flex flex-none items-center justify-center gap-2.5 pt-3.5 pb-1">
        <button
          type="button"
          onClick={handleClose}
          className="mr-2.5 cursor-pointer rounded-xs p-1.5 text-[11px] text-ink-onnight hover:text-white focus-visible:ring-3 focus-visible:ring-white/30 focus-visible:outline-none"
        >
          ← Quitter
        </button>
        {steps.map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'h-[7px] rounded-[4px] transition-all duration-300',
              i === step ? 'w-5.5' : 'w-[7px]',
              i <= step ? 'bg-[#2f7bff]' : 'bg-[#34364a]',
            )}
          />
        ))}
      </div>
    </div>
  )
}

/** Cases de la semaine : les 7 jours réels en cadence quotidienne, sinon les séances. */
function cellsFor(
  objective: Objective,
  weekIndex: Map<string, { cadence_target: number; active_days: number }>,
  weekNo: number,
  activeDays: Set<string> | undefined,
  weekStart: IsoDate,
): boolean[] {
  const week = weekIndex.get(`${objective.id}|${weekNo}`)
  const target = week?.cadence_target ?? objective.cadence ?? 1
  const done = week?.active_days ?? 0
  if (target === 7) {
    return daysOfWeek(weekStart).map((day) => activeDays?.has(`${objective.id}|${day}`) ?? false)
  }
  return Array.from({ length: target }, (_, i) => i < done)
}

function statFor(
  objective: Objective,
  weekIndex: Map<string, { cadence_target: number; active_days: number }>,
  weekNo: number,
): string {
  const week = weekIndex.get(`${objective.id}|${weekNo}`)
  const target = week?.cadence_target ?? objective.cadence ?? 1
  const done = week?.active_days ?? 0
  return target === 7
    ? `${done} jour${done > 1 ? 's' : ''} accompli${done > 1 ? 's' : ''} cette semaine`
    : `${done}/${target} séances cette semaine`
}
