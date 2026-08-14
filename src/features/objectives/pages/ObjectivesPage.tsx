import { useEffect, useMemo, useState } from 'react'
import { Spinner } from '../../../components/ui/Spinner'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAppToday } from '../../../hooks/useAppToday'
import { useMilestones, groupByObjective } from '../../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { NO_RATINGS, useQuarterRatings } from '../../../hooks/useQuarterRatings'
import { indexWeeks, useObjectiveWeeks } from '../../../hooks/useObjectiveWeeks'
import {
  MAX_PRINCIPALS,
  selectPrincipals,
  selectSecondaries,
  useObjectives,
  type Objective,
} from '../../../hooks/useObjectives'
import { useAuth } from '../../auth/useAuth'
import { dataErrorMessage } from '../../../lib/errorMessage'
import {
  addDays,
  daysOfWeek as weekDaysOf,
  isoWeek,
  quarterAnchor,
  quarterOf,
  weeksOfQuarter,
  weeksOfQuarterRefs,
  year as yearOf,
  type IsoDate,
} from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { ObjectiveDetail } from '../components/ObjectiveDetail'
import { ObjectiveFormModal } from '../components/ObjectiveFormModal'
import { ObjectivePicker } from '../components/ObjectivePicker'
import { YearProgressBar } from '../components/YearProgressBar'
import type { ObjectiveKind } from '../../../hooks/useObjectiveMutations'

export function ObjectivesPage() {
  const { session } = useAuth()
  const userId = session?.user.id

  const todayQuery = useAppToday()
  const today = todayQuery.data

  const year = today ? yearOf(today) : undefined
  const currentQuarter = today ? quarterOf(today) : undefined
  const currentWeek = today ? isoWeek(today) : undefined

  const [selectedQuarter, setSelectedQuarter] = useState<number | undefined>()
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [formKind, setFormKind] = useState<ObjectiveKind>('principal')
  const [editing, setEditing] = useState<Objective | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  // Le trimestre affiché suit celui du serveur tant que l'utilisateur n'a pas
  // choisi : l'ancre est `app_today()`, jamais l'horloge du navigateur.
  useEffect(() => {
    if (selectedQuarter === undefined && currentQuarter) setSelectedQuarter(currentQuarter)
  }, [currentQuarter, selectedQuarter])

  const objectivesQuery = useObjectives(year)
  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const secondaries = useMemo(
    () => selectSecondaries(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const allObjectives = useMemo(
    () => [...principals, ...secondaries],
    [principals, secondaries],
  )
  const objectiveIds = useMemo(() => allObjectives.map((o) => o.id), [allObjectives])

  // La sélection retombe sur le premier objectif tant qu'elle est vide ou que
  // la cible a disparu (suppression, changement d'année).
  const selected =
    allObjectives.find((o) => o.id === selectedId) ?? allObjectives[0] ?? undefined

  // Chaque trimestre a sa propre grille : les colonnes suivent le rail Q1–Q4,
  // pas une fenêtre glissante depuis aujourd'hui.
  const quarterStart = useMemo(
    () => (year && selectedQuarter ? quarterAnchor(year, selectedQuarter) : undefined),
    [year, selectedQuarter],
  )

  const heatmapWeeks = useMemo(
    () => (quarterStart ? weeksOfQuarter(quarterStart) : []),
    [quarterStart],
  )

  // La plage de jours crédités doit couvrir les COLONNES affichées, qui
  // débordent du trimestre civil (la première commence au lundi de la semaine
  // du 1er). Sans ça, les cases hors plage resteraient vides.
  const heatmapRange = useMemo(() => {
    if (heatmapWeeks.length === 0) return undefined
    return { from: heatmapWeeks[0]!, to: addDays(heatmapWeeks[heatmapWeeks.length - 1]!, 6) }
  }, [heatmapWeeks])

  const weeksQuery = useObjectiveWeeks(objectiveIds, currentWeek?.isoYear)
  const activeDaysQuery = useObjectiveActiveDays(
    objectiveIds,
    heatmapRange?.from,
    heatmapRange?.to,
  )
  const milestonesQuery = useMilestones(objectiveIds, year, selectedQuarter)

  const quarterWeekRefs = useMemo(
    () => (quarterStart ? weeksOfQuarterRefs(quarterStart) : []),
    [quarterStart],
  )

  // Un seul objectif ici — la sparkline ne montre que celui qui est affiché.
  const ratingObjectiveIds = useMemo(() => (selected ? [selected.id] : []), [selected])
  const ratingsQuery = useQuarterRatings(ratingObjectiveIds, quarterWeekRefs, selectedQuarter)

  const weekIndex = useMemo(() => indexWeeks(weeksQuery.data), [weeksQuery.data])
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )

  // Relevés du seul objectif affiché, dans l'ordre des colonnes : la tendance
  // se lit sur cette série, jamais sur un recalcul depuis les tâches.
  const selectedWeeks = useMemo(() => {
    if (!selected) return []
    return heatmapWeeks
      .map((monday) => weekIndex.get(`${selected.id}|${isoWeek(monday).isoWeek}`))
      .filter((w) => w !== undefined)
  }, [selected, heatmapWeeks, weekIndex])

  const monthLabels = useMemo(() => monthsOf(heatmapWeeks), [heatmapWeeks])

  const queries = [todayQuery, objectivesQuery, weeksQuery, activeDaysQuery, milestonesQuery, ratingsQuery]
  const failed = queries.filter((q) => q.error !== null)
  const firstError = failed[0]?.error ?? null
  const retrying = failed.some((q) => q.isFetching)

  function handleRetry() {
    for (const query of failed) void query.refetch()
  }

  function openCreate(kind: ObjectiveKind) {
    setFormKind(kind)
    setEditing(undefined)
    setFormOpen(true)
  }

  function openEdit(objective: Objective) {
    setEditing(objective)
    setFormOpen(true)
  }

  if (todayQuery.isPending) {
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
          title="Impossible de charger vos objectifs"
          description={dataErrorMessage(todayQuery.error)}
          onRetry={handleRetry}
          retrying={retrying}
          className="max-w-md"
        />
      </div>
    )
  }

  // Archivage dérivé : une année révolue est en lecture seule totale (SPEC §3).
  const readOnly = false
  const principalsFull = principals.length >= MAX_PRINCIPALS
  const empty = allObjectives.length === 0

  return (
    <div className="flex flex-col gap-4 sm:gap-5.5">
      <div className="flex items-center gap-3 sm:gap-4">
        <h1 className="text-[22px] font-medium sm:text-[20px] sm:font-semibold">
          Objectifs {year}
        </h1>

        {!empty && (
          <button
            type="button"
            onClick={() => openCreate('principal')}
            disabled={principalsFull}
            title={principalsFull ? 'Maximum 3 objectifs principaux' : undefined}
            className={cn(
              'ml-auto rounded-md px-4 py-2.5 text-body font-medium transition-all duration-150',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              principalsFull
                ? 'cursor-not-allowed bg-field text-ink-muted'
                : 'cursor-pointer bg-primary text-white shadow-primary hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active',
            )}
          >
            <span className="hidden sm:inline">+ Nouvel objectif</span>
            <span className="sm:hidden">+</span>
            {principalsFull && ` · ${principals.length}/${MAX_PRINCIPALS}`}
          </button>
        )}
      </div>

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}

      {empty ? (
        <EmptyObjectives onCreate={() => openCreate('principal')} />
      ) : (
        <>
          <YearProgressBar
            today={today!}
            year={year!}
            currentQuarter={currentQuarter!}
            selectedQuarter={selectedQuarter ?? currentQuarter!}
            onSelectQuarter={setSelectedQuarter}
          />

          {/* mobile : un select remplace le rail */}
          <div className="flex gap-2 lg:hidden">
            <label className="sr-only" htmlFor="objective-select">
              Objectif affiché
            </label>
            <select
              id="objective-select"
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-3.5 py-2.5 text-body text-ink outline-none focus:border-primary"
            >
              {principals.length > 0 && (
                <optgroup label="Principaux">
                  {principals.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </optgroup>
              )}
              {secondaries.length > 0 && (
                <optgroup label="Secondaires">
                  {secondaries.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={() => openCreate('secondaire')}
              className="shrink-0 cursor-pointer rounded-md border border-border bg-surface px-3.5 py-2.5 text-body font-medium text-ink-2 transition-colors duration-150 hover:border-border-strong"
            >
              + Secondaire
            </button>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[290px_1fr]">
            <div className="hidden lg:block">
              <ObjectivePicker
                principals={principals}
                secondaries={secondaries}
                selectedId={selected?.id}
                onSelect={setSelectedId}
                onCreateSecondary={() => openCreate('secondaire')}
                readOnly={readOnly}
              />
            </div>

            {selected && (
              <ObjectiveDetail
                key={selected.id}
                objective={selected}
                weekIndex={weekIndex}
                objectiveWeeks={selectedWeeks}
                activeDays={activeDaysQuery.data ?? new Set<string>()}
                weekDays={today ? weekDaysOf(today) : []}
                heatmapWeeks={heatmapWeeks}
                monthLabels={monthLabels}
                quarterWeeks={quarterWeekRefs}
                ratings={ratingsQuery.data ?? NO_RATINGS}
                milestones={milestonesByObjective.get(selected.id) ?? []}
                quarter={selectedQuarter ?? currentQuarter!}
                today={today!}
                currentWeekNo={currentWeek!.isoWeek}
                readOnly={readOnly}
                onEdit={() => openEdit(selected)}
              />
            )}
          </div>
        </>
      )}

      {userId && year && (
        <ObjectiveFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          userId={userId}
          year={year}
          kind={formKind}
          objective={editing}
        />
      )}
    </div>
  )
}

function EmptyObjectives({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-2xl border-[1.5px] border-dashed border-border-strong bg-surface px-5 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-xl bg-primary text-[24px] text-white">
        ◎
      </span>
      <h2 className="text-[17px] font-semibold">Posez vos trois objectifs de l’année</h2>
      <p className="max-w-105 text-body leading-relaxed text-ink-3">
        Choisissez ce qui décidera si votre année a compté. Vos tâches viendront s’y relier, et
        chaque semaine vous verrez votre régularité.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 cursor-pointer rounded-lg bg-primary px-5.5 py-3.5 text-body font-medium text-white shadow-primary transition-all duration-150 hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
      >
        Créer mon premier objectif
      </button>
    </div>
  )
}

/** Mois couverts par les colonnes de la heatmap, dans l'ordre, sans doublon. */
function monthsOf(weeks: IsoDate[]): string[] {
  const format = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
  const seen = new Set<string>()
  const labels: string[] = []
  for (const monday of weeks) {
    const key = monday.slice(0, 7)
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(format.format(new Date(`${monday}T12:00:00Z`)).replace('.', '').toUpperCase())
  }
  return labels
}
