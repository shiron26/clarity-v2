import { useMemo, useState } from 'react'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAppToday } from '../../../hooks/useAppToday'
import { useMilestones, groupByObjective } from '../../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useObjectiveEntries } from '../../../hooks/useObjectiveEntries'
import { useObjectivePeriods } from '../../../hooks/useObjectivePeriods'
import { useObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import { useObjectiveRegularity } from '../../../hooks/useObjectiveRegularity'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import {
  selectPrincipals,
  selectSecondaries,
  useObjectives,
  type Objective,
} from '../../../hooks/useObjectives'
import { useAuth } from '../../auth/useAuth'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { year as yearOf, type IsoDate } from '../../../lib/appDate'
import { periodYearFor } from '../../../lib/objectivePeriod'
import { heatmapRange, heatmapWindow } from '../../../lib/objectiveWindow'
import { isWithinWindow } from '../../../lib/objectiveFeasibility'
import { ObjectiveDetail } from '../components/ObjectiveDetail'
import { ObjectiveEditModal } from '../components/ObjectiveEditModal'
import { ObjectiveWizardModal } from '../../../components/objectives/ObjectiveWizardModal'
import { ObjectiveRail } from '../components/ObjectiveRail'
import { EmptyObjectives } from '../components/EmptyObjectives'
import type { ObjectiveKind } from '../../../hooks/useObjectiveMutations'
import { usePrivacy } from '../../../hooks/usePrivacy'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { PageLoading, PageError } from '../../../components/layout/PageState'

export function ObjectivesPage() {
  const { session } = useAuth()
  const userId = session?.user.id

  const { privacy } = usePrivacy()

  const todayQuery = useAppToday()
  const today = todayQuery.data
  const year = today ? yearOf(today) : undefined

  const [selectedId, setSelectedId] = useState<string | undefined>()
  // `editing` n'est PAS remis à `undefined` à la fermeture : `Modal` garde son
  // panneau monté 360 ms le temps de la sortie animée, et l'objectif
  // disparaîtrait en pleine descente. D'où un booléen à côté, plutôt qu'un
  // `open={!!editing}`.
  const [editing, setEditing] = useState<Objective | undefined>()
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const objectivesQuery = useObjectives(year)

  // Trois rangs, et un objectif arrêté quitte le sien : il n'est plus « porté ».
  // Il garde en revanche son emplacement jusqu'à la fin de sa fenêtre, ce que
  // comptent `principalSlotsUsed` / `secondarySlotsUsed` plus bas.
  const { principals, secondaries, stopped, all } = useMemo(() => {
    const open = (o: Objective) => o.closed_at === null
    const principalsAll = selectPrincipals(objectivesQuery.data)
    const secondariesAll = selectSecondaries(objectivesQuery.data)
    return {
      principals: principalsAll.filter(open),
      secondaries: secondariesAll.filter(open),
      stopped: [...principalsAll, ...secondariesAll].filter((o) => !open(o)),
      all: [...principalsAll, ...secondariesAll],
    }
  }, [objectivesQuery.data])

  const objectiveIds = useMemo(() => all.map((o) => o.id), [all])

  const selected = all.find((o) => o.id === selectedId) ?? all[0] ?? undefined

  // Les relevés se lisent par unité, et les deux n'ont pas la même année :
  // `period_year` vaut l'année **ISO** en hebdomadaire, l'année **civile** en
  // mensuel (private.period_year). Les confondre ferait manquer les périodes de
  // fin décembre sans lever la moindre erreur.
  const weekIds = useMemo(
    () => all.filter((o) => o.period_unit === 'week').map((o) => o.id),
    [all],
  )
  const monthIds = useMemo(
    () => all.filter((o) => o.period_unit === 'month').map((o) => o.id),
    [all],
  )

  const weekPeriodsQuery = useObjectivePeriods(
    weekIds,
    'week',
    today ? periodYearFor('week', today) : undefined,
  )
  const monthPeriodsQuery = useObjectivePeriods(
    monthIds,
    'month',
    today ? periodYearFor('month', today) : undefined,
  )

  const regularityQuery = useObjectiveRegularity(objectiveIds)
  const progressQuery = useObjectiveProgress(objectiveIds)

  // La grille se borne à la fenêtre de l'objectif AFFICHÉ : le trimestre n'est
  // plus choisi ici, il se déduit (REFONTE §4 — l'année se consulte au §6).
  const window = useMemo(
    () => (selected && today ? heatmapWindow(selected, today) : undefined),
    [selected, today],
  )
  const range = useMemo(() => (window ? heatmapRange(window.weeks) : undefined), [window])

  const activeDaysQuery = useObjectiveActiveDays(
    selected ? [selected.id] : [],
    range?.from,
    range?.to,
  )
  const milestonesQuery = useMilestones(objectiveIds, year, window?.quarter)
  const openingsQuery = useReviewOpenings(year ? [year] : [])

  // Saisies du seul objectif affiché : la projection d'une quantité s'y lit, et
  // sa key ne porte qu'un identifiant — rien à gagner à la grouper.
  const entriesQuery = useObjectiveEntries(
    selected?.measure === 'quantite' ? selected.id : undefined,
  )

  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )

  const selectedPeriods = useMemo(() => {
    if (!selected) return []
    const rows =
      selected.period_unit === 'month' ? monthPeriodsQuery.data : weekPeriodsQuery.data
    return (rows ?? []).filter((p) => p.objective_id === selected.id)
  }, [selected, weekPeriodsQuery.data, monthPeriodsQuery.data])

  const queries = [
    todayQuery,
    objectivesQuery,
    weekPeriodsQuery,
    monthPeriodsQuery,
    regularityQuery,
    progressQuery,
    activeDaysQuery,
    milestonesQuery,
  ]
  const { firstError, retrying, onRetry } = useQueriesState(queries)


  // La nature de l'objectif n'est plus déduite du nombre de places libres :
  // c'est la première question de l'assistant. La déduire rendait « habitude »
  // invisible dès que les trois places étaient prises, et interdisait un
  // secondaire dès qu'il en restait une.
  function openCreate() {
    setCreateOpen(true)
  }

  if (todayQuery.isPending) {
    return (
      <PageLoading />
    )
  }

  // `isLoadingError` : un refetch raté par-dessus des données ne vide pas l'écran.
  if (todayQuery.isLoadingError) {
    return (
      <PageError
        title="Impossible de charger vos objectifs"
        error={todayQuery.error}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  const empty = all.length === 0
  const rail = {
    principals,
    secondaries,
    stopped,
    principalSlotsUsed: principalSlotsUsed(all, today),
    secondarySlotsUsed: secondarySlotsUsed(all, today),
    selectedId: selected?.id,
    onSelect: setSelectedId,
    onCreate: openCreate,
    privacy,
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <h1 className="text-[22px] font-medium sm:text-h1 sm:font-semibold">Objectifs {year}</h1>

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}

      {empty ? (
        <EmptyObjectives onCreate={openCreate} />
      ) : (
        <>
          <ObjectiveRail {...rail} variant="select" className="lg:hidden" />

          <div className="grid items-start gap-5 lg:grid-cols-[262px_1fr]">
            <ObjectiveRail {...rail} variant="rail" className="hidden lg:flex" />

            {selected && window && today && (
              <ObjectiveDetail
                key={selected.id}
                objective={selected}
                periods={selectedPeriods}
                regularity={regularityQuery.data?.get(selected.id)}
                progress={progressQuery.data?.get(selected.id)}
                entries={entriesQuery.data ?? []}
                entriesError={entriesQuery.error}
                milestones={milestonesByObjective.get(selected.id) ?? []}
                activeDays={activeDaysQuery.data ?? new Set<string>()}
                weeks={window.weeks}
                quarter={window.quarter}
                today={today}
                privacy={privacy}
                reviewOpenAt={
                  year
                    ? openingsQuery.data?.get(openingKey('quarter', year, window.quarter))?.openAt
                    : undefined
                }
                onEdit={() => {
                  setEditing(selected)
                  setEditOpen(true)
                }}
                onDeleted={() => setSelectedId(undefined)}
              />
            )}
          </div>
        </>
      )}

      {userId && year && (
        <ObjectiveWizardModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          userId={userId}
          year={year}
          principalSlotsUsed={rail.principalSlotsUsed}
          secondarySlotsUsed={rail.secondarySlotsUsed}
          onCreated={setSelectedId}
        />
      )}

      <ObjectiveEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        objective={editing}
      />
    </div>
  )
}

/**
 * Emplacements occupés **aujourd'hui**, arrêtés compris.
 *
 * Clôturer ne libère pas le slot : c'est la fin de la fenêtre qui le libère
 * (SPEC §3). Un objectif de T1 ne bloque donc rien en T3, mais un annuel arrêté
 * en février occupe sa place jusqu'au 31 décembre. Compter les seules lignes
 * visibles annoncerait une place libre que le serveur refuserait en `slot_full`.
 */
function slotsUsed(objectives: Objective[], today: IsoDate | undefined, kind: ObjectiveKind) {
  if (!today) return 0
  return objectives.filter((o) => o.kind === kind && isWithinWindow(o, today)).length
}

function principalSlotsUsed(objectives: Objective[], today: IsoDate | undefined) {
  return slotsUsed(objectives, today, 'principal')
}

function secondarySlotsUsed(objectives: Objective[], today: IsoDate | undefined) {
  return slotsUsed(objectives, today, 'secondaire')
}
