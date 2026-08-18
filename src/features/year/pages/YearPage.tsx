import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { buttonClasses } from '../../../components/ui/buttonClasses'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { YearStepper } from '../../../components/ui/YearStepper'
import { YearIcon } from '../../../components/icons/YearIcon'
import { useAppToday } from '../../../hooks/useAppToday'
import { useObjectivePeriodsForYear } from '../../../hooks/useObjectivePeriods'
import { useObjectives } from '../../../hooks/useObjectives'
import { usePrivacy } from '../../../hooks/usePrivacy'
import { useQuarterReviews } from '../../../hooks/useReview'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import {
  isoWeek,
  quarterAnchor,
  quarterOf,
  year as yearOf,
  yearProgressPercent,
} from '../../../lib/appDate'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { windowEnd, windowStart } from '../../../lib/objectiveFeasibility'
import { objectivesForPeriod } from '../../../lib/reviewPeriod'
import { YearBanner } from '../components/YearBanner'
import { YearTimeline } from '../../../components/year/YearTimeline'
import { QuarterList, type QuarterSummary } from '../components/QuarterList'
import { buildYearTracks, yearFraction } from '../../../lib/yearTimeline'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { QUARTERS } from '../../../lib/quarterLabels'
import { PageLoading, PageError } from '../../../components/layout/PageState'

/**
 * Le récit de l'année.
 *
 * L'année n'est plus la *durée* d'un objectif — une fenêtre peut être
 * trimestrielle — c'est ce qui s'est passé : une frise où chaque objectif est un
 * segment, à sa place et à sa longueur (REFONTE §6). Lecture pure.
 *
 * **Le détail d'un trimestre vit sur sa propre page** (`/annee/2026/t3`) : les
 * deux niveaux se disputaient le même écran et le rendaient dense. Ici on lit
 * l'année, et les quatre trimestres sont des portes.
 *
 * Le fetching et l'état d'écran vivent ici, les bandes sont muettes et reçoivent
 * leurs données en props — même forme que `HomePage` et `ObjectivesPage`.
 */
export function YearPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { privacy } = usePrivacy()

  const todayQuery = useAppToday()
  const today = todayQuery.data
  const currentYear = today ? yearOf(today) : undefined
  const currentQuarter = today ? quarterOf(today) : undefined

  // L'année vit dans l'URL et non dans un state : c'est ce qui permet au fil
  // d'Ariane d'une sous-page de revenir sur la BONNE année.
  const routeYear = Number(params.year)
  const year = Number.isFinite(routeYear) ? routeYear : currentYear
  const isCurrentYear = year !== undefined && year === currentYear

  // « Aujourd'hui » n'existe que sur l'année en cours : une année révolue n'a ni
  // trait orange, ni voile, ni période à venir.
  const anchor = isCurrentYear && today ? today : null

  const objectivesQuery = useObjectives(year)

  const objectives = useMemo(
    () =>
      (objectivesQuery.data ?? []).filter(
        (o) => o.user_id !== null && o.parent_objective_id === null,
      ),
    [objectivesQuery.data],
  )

  const { periods, queries: periodQueries } = useObjectivePeriodsForYear(objectives, year)

  const openingsQuery = useReviewOpenings(year ? [year] : [])
  const reviewsQuery = useQuarterReviews(year)

  const tracks = useMemo(
    () => (year ? buildYearTracks({ objectives, periods, year, today: anchor }) : []),
    [objectives, periods, year, anchor],
  )

  // Ce que chaque trimestre a porté. La règle de clôture d'abord
  // (`objectivesForPeriod`), puis le recouvrement de fenêtre — un objectif de T1
  // n'a rien à faire dans la ligne de T3.
  const summaries = useMemo((): QuarterSummary[] => {
    if (!year) return []
    return QUARTERS.map((quarter) => {
      const from = quarterAnchor(year, quarter)
      const to = windowEnd(year, quarter)
      return {
        quarter,
        carried: objectivesForPeriod(objectives, from).filter(
          (o) =>
            windowStart(o.year, o.quarter) < to && windowEnd(o.year, o.quarter) > from,
        ),
        ahead: anchor !== null && from > anchor,
        current: isCurrentYear && quarter === currentQuarter,
        opening: openingsQuery.data?.get(openingKey('quarter', year, quarter)),
        review: reviewsQuery.data?.get(quarter),
      }
    })
  }, [
    objectives,
    year,
    anchor,
    isCurrentYear,
    currentQuarter,
    openingsQuery.data,
    reviewsQuery.data,
  ])

  const queries = [todayQuery, objectivesQuery, ...periodQueries, openingsQuery, reviewsQuery]
  const { firstError, retrying, onRetry } = useQueriesState(queries)


  if (todayQuery.isPending) {
    return (
      <PageLoading />
    )
  }

  if (todayQuery.isError) {
    return (
      <PageError
        title="Impossible de charger votre année"
        error={todayQuery.error}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  const percent = isCurrentYear && today ? yearProgressPercent(today) : null
  const caption = isCurrentYear && today ? `Semaine ${isoWeek(today).isoWeek}` : 'Année terminée'
  const reached = objectives.filter((o) => o.closed_at !== null).length
  const now = anchor && year ? yearFraction(anchor, year) : null

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-medium lg:text-h1 lg:font-semibold">Année</h1>
        {year && currentYear && (
          <YearStepper
            year={year}
            currentYear={currentYear}
            onSelectYear={(next) => void navigate(`/annee/${next}`)}
            size="lg"
          />
        )}
      </div>

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}

      {year === undefined ? null : objectives.length === 0 ? (
        <EmptyState
          icon={<YearIcon className="size-6" />}
          title={`Rien à raconter pour ${year}`}
          description="Vos objectifs dessineront cette frise à mesure que vous les porterez."
          action={
            <Link to="/objectifs" className={buttonClasses()}>
              Voir mes objectifs
            </Link>
          }
        />
      ) : (
        <>
          <YearBanner
            year={year}
            caption={caption}
            percent={percent}
            meta={`${objectives.length} objectif${objectives.length > 1 ? 's' : ''} porté${objectives.length > 1 ? 's' : ''} · ${reached} mené${reached > 1 ? 's' : ''} au bout`}
          >
            {/* Deux rendus derrière des classes plutôt qu'un seul paramétré :
                `overview` change la matière même de la barre (des segments pleins,
                sans les 52 cellules), et 52 semaines à 390 px ne se lisent pas.
                Même geste que `ObjectiveRail` et ses deux variantes. */}
            <YearTimeline
              tracks={tracks}
              now={now}
              overview
              privacy={privacy}
              className="lg:hidden"
            />
            <YearTimeline
              tracks={tracks}
              now={now}
              overview={false}
              privacy={privacy}
              className="hidden lg:flex"
            />
          </YearBanner>

          <QuarterList year={year} summaries={summaries} privacy={privacy} />
        </>
      )}
    </div>
  )
}
