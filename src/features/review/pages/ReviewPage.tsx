import { useEffect, useMemo, useState } from 'react'
import { Spinner } from '../../../components/ui/Spinner'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAppToday } from '../../../hooks/useAppToday'
import { useObjectives, selectPrincipals, selectSecondaries } from '../../../hooks/useObjectives'
import { NO_RATINGS, quarterRatingKey, useQuarterRatings } from '../../../hooks/useQuarterRatings'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import { useReview, useReviewItems, type PeriodRef } from '../../../hooks/useReview'
import { useEnsureReview } from '../../../hooks/useReviewMutations'
import { useAuth } from '../../auth/useAuth'
import { dataErrorMessage } from '../../../lib/errorMessage'
import {
  isoWeek,
  quarterAnchor,
  quarterOf,
  weeksOfQuarterRefs,
  year as yearOf,
} from '../../../lib/appDate'
import { ReviewEmpty } from '../components/ReviewEmpty'
import { ReviewFlow } from '../components/ReviewFlow'
import { ReviewHub } from '../components/ReviewHub'
import { objectivesForPeriod } from '../reviewPeriod'

type FlowKind = 'week' | 'quarter'

export function ReviewPage() {
  const { session } = useAuth()
  const userId = session?.user.id

  const todayQuery = useAppToday()
  const today = todayQuery.data

  const currentYear = today ? yearOf(today) : undefined
  const currentQuarter = today ? quarterOf(today) : undefined
  const currentWeek = today ? isoWeek(today) : undefined

  const [selectedYear, setSelectedYear] = useState<number | undefined>()
  const [selectedQuarter, setSelectedQuarter] = useState<number | undefined>()
  const [selectedWeek, setSelectedWeek] = useState<number | undefined>()
  const [flow, setFlow] = useState<FlowKind | null>(null)

  // L'écran s'ouvre sur la période vécue par le serveur, jamais sur celle du
  // navigateur — puis suit les choix de l'utilisateur (cf. ObjectivesPage).
  useEffect(() => {
    if (selectedYear === undefined && currentYear) setSelectedYear(currentYear)
    if (selectedQuarter === undefined && currentQuarter) setSelectedQuarter(currentQuarter)
  }, [currentYear, currentQuarter, selectedYear, selectedQuarter])

  const year = selectedYear
  const quarter = selectedQuarter

  const weeks = useMemo(
    () => (year && quarter ? weeksOfQuarterRefs(quarterAnchor(year, quarter)) : []),
    [year, quarter],
  )

  // La semaine mise en avant : celle en cours si le trimestre affiché la
  // contient, sinon la dernière déjà vécue, sinon la première.
  const defaultWeek = useMemo(() => {
    if (weeks.length === 0 || !today) return undefined
    const live = weeks.find((w) => w.weekNo === currentWeek?.isoWeek)
    if (live) return live.weekNo
    const lived = [...weeks].reverse().find((w) => w.monday <= today)
    return (lived ?? weeks[0])!.weekNo
  }, [weeks, today, currentWeek])

  // Changer de trimestre ou d'année remet la sélection sur cette semaine-là.
  useEffect(() => {
    setSelectedWeek(undefined)
  }, [year, quarter])

  // Le numéro suffit à identifier la semaine DANS la grille (treize semaines
  // consécutives ne répètent jamais un numéro) ; l'année ISO se relit ensuite
  // sur la semaine elle-même, elle ne se déduit pas du trimestre.
  const week = selectedWeek ?? defaultWeek
  const selected = weeks.find((w) => w.weekNo === week)
  const selectedMonday = selected?.monday
  const selectedIsoYear = selected?.isoYear

  const objectivesQuery = useObjectives(year)
  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const secondaries = useMemo(
    () => selectSecondaries(objectivesQuery.data),
    [objectivesQuery.data],
  )

  // Portée par niveau (SPEC §4.4), puis filtre de clôture : un objectif clôturé
  // disparaît des périodes qui commencent après sa clôture.
  const weekObjectives = useMemo(
    () => (selectedMonday ? objectivesForPeriod(principals, selectedMonday) : []),
    [principals, selectedMonday],
  )
  // Le bilan trimestriel ajoute les secondaires : c'est le seul rituel qui les
  // juge, puisqu'ils n'ont pas de cadence hebdomadaire (SPEC §4.4).
  const quarterObjectives = useMemo(() => {
    if (!year || !quarter) return []
    return objectivesForPeriod(
      [...principals, ...secondaries],
      quarterAnchor(year, quarter),
    )
  }, [principals, secondaries, year, quarter])

  const gridObjectiveIds = useMemo(() => principals.map((o) => o.id), [principals])

  const ratingsQuery = useQuarterRatings(gridObjectiveIds, weeks, quarter)
  const ratings = ratingsQuery.data ?? NO_RATINGS

  // Les années à interroger : celle du trimestre affiché (pour son bilan) et les
  // années ISO de ses semaines, qui peuvent déborder d'un cran.
  const openingYears = useMemo(
    () => (year ? [year, ...weeks.map((w) => w.isoYear)] : []),
    [year, weeks],
  )
  const openingsQuery = useReviewOpenings(openingYears)
  const openings = openingsQuery.data

  const quarterPeriod: PeriodRef | undefined =
    year && quarter ? { type: 'quarter', year, index: quarter } : undefined
  const quarterReviewQuery = useReview(quarterPeriod)
  const quarterReview = quarterReviewQuery.data ?? undefined
  const quarterItemsQuery = useReviewItems(quarterReview?.id)

  const ensureReview = useEnsureReview()

  const ratedCount = useMemo(() => {
    if (week === undefined || selectedIsoYear === undefined) return 0
    return weekObjectives.filter(
      (o) => ratings.get(quarterRatingKey(o.id, selectedIsoYear, week)) !== undefined,
    ).length
  }, [weekObjectives, ratings, week, selectedIsoYear])

  const quarterDone = useMemo(() => {
    const items = quarterItemsQuery.data
    if (!items || quarterObjectives.length === 0) return false
    return quarterObjectives.every((o) => items.get(o.id)?.rating != null)
  }, [quarterItemsQuery.data, quarterObjectives])

  const queries = [
    todayQuery,
    objectivesQuery,
    ratingsQuery,
    openingsQuery,
    quarterReviewQuery,
    quarterItemsQuery,
  ]
  const failed = queries.filter((q) => q.error !== null)
  const firstError = failed[0]?.error ?? null
  const retrying = failed.some((q) => q.isFetching)

  function handleRetry() {
    for (const query of failed) void query.refetch()
  }

  const weekOpening =
    week !== undefined && selectedIsoYear !== undefined
      ? openings?.get(openingKey('week', selectedIsoYear, week))
      : undefined
  const quarterOpening =
    year && quarter ? openings?.get(openingKey('quarter', year, quarter)) : undefined

  function periodFor(kind: FlowKind): PeriodRef | undefined {
    if (!year || !quarter) return undefined
    if (kind === 'quarter') return { type: 'quarter', year, index: quarter }
    if (week === undefined || selectedIsoYear === undefined) return undefined
    return { type: 'week', year: selectedIsoYear, index: week }
  }

  const flowPeriod = flow ? periodFor(flow) : undefined

  async function startFlow(kind: FlowKind) {
    if (!userId) return
    const period = periodFor(kind)
    if (!period) return

    try {
      await ensureReview.mutateAsync({ userId, period })
      setFlow(kind)
    } catch {
      // L'échec remonte déjà par `ensureReview.error` — l'overlay ne s'ouvre pas
      // sur une session qui n'existe pas.
    }
  }

  if (todayQuery.isPending || objectivesQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-ink-muted" />
      </div>
    )
  }

  if (todayQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <ErrorState
          title="Impossible de charger votre review"
          description={dataErrorMessage(todayQuery.error)}
          onRetry={handleRetry}
          retrying={retrying}
          className="max-w-md"
        />
      </div>
    )
  }

  if (principals.length === 0 && secondaries.length === 0) {
    return <ReviewEmpty />
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5.5">
      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}

      {ensureReview.error && (
        <ErrorState description={dataErrorMessage(ensureReview.error)} />
      )}

      {year && quarter && today && (
        <ReviewHub
          year={year}
          currentYear={currentYear!}
          quarter={quarter}
          currentQuarter={currentQuarter}
          weeks={weeks}
          selectedWeek={week}
          selectedMonday={selectedMonday}
          currentWeek={currentWeek?.isoWeek}
          today={today}
          objectives={weekObjectives}
          ratings={ratings}
          ratedCount={ratedCount}
          weekOpen={weekOpening?.isOpen ?? false}
          quarterOpenAt={quarterOpening?.openAt}
          quarterIsOpen={quarterOpening?.isOpen ?? false}
          quarterDone={quarterDone}
          onSelectYear={setSelectedYear}
          onSelectQuarter={setSelectedQuarter}
          onSelectWeek={setSelectedWeek}
          onStartWeek={() => void startFlow('week')}
          onStartQuarter={() => void startFlow('quarter')}
        />
      )}

      {flow && flowPeriod && selectedMonday && quarter && (
        <ReviewFlow
          period={flowPeriod}
          weekStart={selectedMonday}
          weekNo={week!}
          currentWeekNo={year === currentYear ? currentWeek?.isoWeek : undefined}
          quarter={quarter}
          quarterWeeks={weeks}
          objectives={flow === 'quarter' ? quarterObjectives : weekObjectives}
          onClose={() => setFlow(null)}
        />
      )}
    </div>
  )
}
