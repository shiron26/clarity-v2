import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAppToday } from '../../../hooks/useAppToday'
import { useMilestones } from '../../../hooks/useMilestones'
import { useObjectiveEntriesRange } from '../../../hooks/useObjectiveEntries'
import { useObjectivePeriodsForYear } from '../../../hooks/useObjectivePeriods'
import { useObjectives } from '../../../hooks/useObjectives'
import { usePrivacy } from '../../../hooks/usePrivacy'
import { useReview } from '../../../hooks/useReview'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import { quarterAnchor, weeksOfQuarterRefs, year as yearOf } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { objectivesForPeriod, objectivesForQuarter } from '../../../lib/reviewPeriod'
import { QuarterBoard } from '../components/QuarterBoard'
import { QuarterHeader } from '../components/QuarterHeader'
import { buildQuarterLines } from '../quarterLines'
import { parseQuarterParam } from '../../../lib/quarterLabels'
import { emptyQuarterCopy } from '../yearContent'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { PageLoading, PageError } from '../../../components/layout/PageState'

/**
 * Le détail d'un trimestre — l'étage du dessous de l'écran Année.
 *
 * L'année raconte, le trimestre détaille. Les deux se disputaient le même écran
 * et le rendaient dense ; ici chacun respire, et l'adresse
 * `/annee/2026/t3` se partage et se met en favori.
 */
export function QuarterPage() {
  const params = useParams()
  const { privacy } = usePrivacy()
  const year = Number(params.year)
  const quarter = parseQuarterParam(params.quarter)

  const todayQuery = useAppToday()
  const today = todayQuery.data
  const currentYear = today ? yearOf(today) : undefined

  const objectivesQuery = useObjectives(Number.isFinite(year) ? year : undefined)

  const objectives = useMemo(
    () =>
      (objectivesQuery.data ?? []).filter(
        (o) => o.user_id !== null && o.parent_objective_id === null,
      ),
    [objectivesQuery.data],
  )
  const objectiveIds = useMemo(() => objectives.map((o) => o.id), [objectives])

  const { periods, queries: periodQueries } = useObjectivePeriodsForYear(
    objectives,
    Number.isFinite(year) ? year : undefined,
  )

  const entriesQuery = useObjectiveEntriesRange(
    objectiveIds,
    Number.isFinite(year) ? `${year}-01-01` : undefined,
    Number.isFinite(year) ? `${year}-12-31` : undefined,
  )
  const milestonesQuery = useMilestones(objectiveIds, year, quarter ?? undefined)
  const openingsQuery = useReviewOpenings(Number.isFinite(year) ? [year] : [])
  const reviewQuery = useReview(
    quarter ? { type: 'quarter', year, index: quarter } : undefined,
  )

  // « Aujourd'hui » n'existe que dans l'année en cours : ailleurs, ni période à
  // venir, ni trimestre « pas encore commencé ».
  const anchor = today && year === currentYear ? today : null

  const weeks = useMemo(
    () => (quarter ? weeksOfQuarterRefs(quarterAnchor(year, quarter)) : []),
    [year, quarter],
  )

  const lines = useMemo(() => {
    if (!quarter) return []
    return buildQuarterLines({
      objectives: objectivesForPeriod(objectives, quarterAnchor(year, quarter)),
      periods,
      entries: entriesQuery.data ?? [],
      milestones: milestonesQuery.data ?? [],
      weeks,
      year,
      quarter,
      today: anchor,
    })
  }, [objectives, periods, entriesQuery.data, milestonesQuery.data, weeks, year, quarter, anchor])

  // Ce que le bilan de ce trimestre mettrait au jugement — la MÊME règle que
  // `BilanPage`, sinon l'en-tête proposerait un bouton menant à un écran vide.
  // `lines` ne peut pas servir de compte : il est construit sur
  // `objectivesForPeriod`, sans la borne de fenêtre ni celle de création.
  const bilanSubjects = useMemo(
    () => (quarter ? objectivesForQuarter(objectives, year, quarter) : []),
    [objectives, year, quarter],
  )

  const queries = [
    todayQuery,
    objectivesQuery,
    ...periodQueries,
    entriesQuery,
    milestonesQuery,
    openingsQuery,
    reviewQuery,
  ]
  const { firstError, retrying, onRetry } = useQueriesState(queries)


  // Une URL bricolée ne mène nulle part : on retombe sur l'année.
  if (!Number.isFinite(year) || quarter === null) return <Navigate to="/annee" replace />

  if (todayQuery.isPending) {
    return (
      <PageLoading />
    )
  }

  if (todayQuery.isError) {
    return (
      <PageError
        title="Impossible de charger ce trimestre"
        error={todayQuery.error}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  const opening = openingsQuery.data?.get(openingKey('quarter', year, quarter))
  const ahead = anchor !== null && quarterAnchor(year, quarter) > anchor
  const copy = emptyQuarterCopy(quarter, ahead)

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      {/* Le retour à l'année : un chevron dans sa pastille, puis le libellé.
          Collé au texte, le chevron se lisait comme une ponctuation ; posé dans
          un cercle, il devient l'affordance, et l'écart entre les deux n'est plus
          une question de chasse de police. Le cercle recule d'un cheveu au
          survol — le seul mouvement de la page, et il va dans le sens du
          voyage. */}
      <Link
        to={`/annee/${year}`}
        className="group inline-flex w-fit items-center gap-2.5 rounded-md py-1 text-body font-medium text-ink-2 transition-colors duration-150 hover:text-ink focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface',
            'pr-px text-[13px] leading-none text-ink-3 shadow-card',
            'transition-[border-color,color,transform] duration-150',
            'group-hover:-translate-x-0.5 group-hover:border-border-strong group-hover:text-ink',
          )}
        >
          ‹
        </span>
        Année {year}
      </Link>

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}

      <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <QuarterHeader
          year={year}
          quarter={quarter}
          isYearEnd={quarter === 4}
          openAt={opening?.openAt}
          isOpen={opening?.isOpen ?? false}
          validatedAt={reviewQuery.data?.validated_at ?? null}
          hasSubjects={bilanSubjects.length > 0}
        />

        {/* Un trimestre qui n'a pas commencé n'a ni rythme ni chiffres — et
            « 0 séance » se lirait comme un échec alors que rien n'a encore pu se
            produire. */}
        {ahead || lines.length === 0 ? (
          // Ni bordure pointillée ni grande icône : un trimestre à venir est une
          // page blanche, pas un manque à combler (REFONTE §10).
          <div className="border-t border-surface-subtle px-4.5 py-9 text-center lg:px-5.5">
            <p className="text-body font-medium text-ink-2">{copy.title}</p>
            <p className="mt-1.5 text-label text-ink-muted">{copy.hint}</p>
          </div>
        ) : (
          <QuarterBoard lines={lines} quarter={quarter} privacy={privacy} />
        )}
      </section>
    </div>
  )
}
