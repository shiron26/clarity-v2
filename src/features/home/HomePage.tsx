import { useMemo, useState } from 'react'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAppToday } from '../../hooks/useAppToday'
import { useLists } from '../../hooks/useLists'
import { groupByObjective, useMilestones } from '../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../hooks/useObjectiveActiveDays'
import { indexPeriods, periodKey, useObjectivePeriods } from '../../hooks/useObjectivePeriods'
import { useObjectiveProgress } from '../../hooks/useObjectiveProgress'
import { selectPrincipals, selectSecondaries, useObjectives } from '../../hooks/useObjectives'

import { usePendingBilan } from '../../hooks/usePendingBilan'
import { useRitualWeek } from '../../hooks/useRitualWeek'
import { useTasks, type Task } from '../../hooks/useTasks'
import { useToggleTask } from '../../hooks/useToggleTask'
import { useUpdateTask } from '../../hooks/useTaskMutations'
import { useDoneSequence } from '../../hooks/useDoneSequence'
import { cn } from '../../lib/cn'
import { dataErrorMessage } from '../../lib/errorMessage'
import {
  objectivesForPeriod,
  objectivesForQuarter,
  objectivesForWeek,
} from '../../lib/reviewPeriod'
import { isWithinWindow } from '../../lib/objectiveFeasibility'
import {
  daysOfWeek as weekDaysOf,
  isoWeek,
  quarterBounds,
  quarterOf,
  year as yearOf,
} from '../../lib/appDate'
import { DashboardPrefsProvider } from './DashboardPrefsProvider'
import { useDashboardPrefs } from './useDashboardPrefs'
import { DashboardSettingsModal } from './components/DashboardSettingsModal'
import { DashboardToolbar } from './components/DashboardToolbar'
import { ObjectivesBlock } from './components/ObjectivesBlock'
import { BilanCard } from './components/BilanCard'
import { OverdueCard } from './components/OverdueCard'
import { RitualCard } from './components/RitualCard'
import { TodayBlock } from './components/TodayBlock'
import { usePrivacy } from '../../hooks/usePrivacy'
import { useQueriesState, type QueryLike } from '../../hooks/useQueriesState'
import { PageLoading, PageError } from '../../components/layout/PageState'

// Le provider de préférences reste interne à la feature : le dashboard est le
// seul écran qui les consomme, App.tsx n'a pas à en connaître l'existence.
export function HomePage() {
  return (
    <DashboardPrefsProvider>
      <Dashboard />
    </DashboardPrefsProvider>
  )
}

/**
 * L'accueil : le rituel, les objectifs, puis la journée.
 *
 * Le fetching vit ici et les blocs sont muets — ils reçoivent leurs données en
 * props (même forme que `ObjectivesPage`). C'est ce qui garde chaque bloc
 * lisible et rend l'état de chargement traitable à un seul endroit.
 */
function Dashboard() {
  const { prefs } = useDashboardPrefs()
  // Le masquage vient de la coquille, pas des préférences du dashboard : il vaut
  // aussi sur Tâches, Objectifs et Année.
  const { privacy } = usePrivacy()
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Tout le dashboard s'ancre sur la date du serveur : rien ne dépend de
  // l'horloge du navigateur.
  const todayQuery = useAppToday()
  const today = todayQuery.data

  const year = today ? yearOf(today) : undefined
  const quarter = today ? quarterOf(today) : undefined
  const currentWeek = today ? isoWeek(today) : undefined

  const objectivesQuery = useObjectives(year)
  // La query charge l'ANNÉE entière ; le dashboard ne parle que d'aujourd'hui.
  // Sans le filtre de fenêtre, un objectif pris pour le trimestre prochain
  // s'affichait ici à « 0 séance cette semaine » — un reproche pour une fenêtre
  // qui n'a pas commencé — et il consommait une place encore libre.
  //
  // `yearPrincipals` reste indispensable au rituel et au bilan : ils jugent une
  // période écoulée, dont les objectifs viennent précisément de sortir de leur
  // fenêtre. Chacun applique son propre filtre (`objectivesForWeek` /
  // `objectivesForPeriod`), calé sur la période jugée et non sur aujourd'hui.
  const yearPrincipals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const principals = useMemo(
    () => (today ? yearPrincipals.filter((o) => isWithinWindow(o, today)) : []),
    [yearPrincipals, today],
  )
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])
  // Le dashboard ne montre jamais les secondaires — sauf pour compter ce que le
  // bilan mettra au jugement : c'est là qu'on en reparle (REFONTE §8).
  const secondaries = useMemo(
    () => selectSecondaries(objectivesQuery.data),
    [objectivesQuery.data],
  )

  const periodsQuery = useObjectivePeriods(principalIds, 'week', currentWeek?.isoYear)
  const progressQuery = useObjectiveProgress(principalIds)
  const milestonesQuery = useMilestones(principalIds, year, quarter)
  const quarterRange = today ? quarterBounds(today) : undefined
  const activeDaysQuery = useObjectiveActiveDays(
    principalIds,
    quarterRange?.from,
    quarterRange?.to,
  )

  const todayTasksQuery = useTasks('today', { today })
  const overdueQuery = useTasks('overdue', { today })
  const listsQuery = useLists()

  // Quel rituel attend — la MÊME source que la page qui l'ouvre, sans quoi
  // l'encart pourrait annoncer une semaine et en ouvrir une autre.
  const ritual = useRitualWeek()
  const bilan = usePendingBilan()

  const toggleTask = useToggleTask()
  const updateTask = useUpdateTask()

  // Index pour le rendu : les vues public.* n'exposent aucune métadonnée de
  // clé étrangère, l'embedding PostgREST est impossible — on joint en mémoire.
  const objectiveById = useMemo(
    () => new Map((objectivesQuery.data ?? []).map((o) => [o.id, o])),
    [objectivesQuery.data],
  )
  const listById = useMemo(
    () => new Map((listsQuery.data ?? []).map((l) => [l.id, l])),
    [listsQuery.data],
  )
  const periodIndex = useMemo(() => indexPeriods(periodsQuery.data), [periodsQuery.data])
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )

  // Le relevé de la semaine en cours, par objectif : le seul dont les blocs ont
  // besoin, alors que la query en charge l'année entière.
  const weekByObjective = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof periodIndex.get>>>()
    if (!currentWeek) return map
    for (const objective of principals) {
      const period = periodIndex.get(
        periodKey(objective.id, 'week', currentWeek.isoYear, currentWeek.isoWeek),
      )
      if (period) map.set(objective.id, period)
    }
    return map
  }, [principals, periodIndex, currentWeek])

  // Les tâches reliées à un objectif remontent en tête : ce sont celles qui
  // font avancer quelque chose.
  const todayTasks = useMemo(() => {
    return [...(todayTasksQuery.data ?? [])].sort((a, b) => {
      const linked = Number(!!b.objective_id) - Number(!!a.objective_id)
      return linked !== 0 ? linked : a.position - b.position
    })
  }, [todayTasksQuery.data])

  // Mémoïsé pour la même raison que `activeDays` juste dessous : un tableau neuf
  // à chaque rendu descend jusqu'à chaque `ObjectiveCard`.
  const weekDays = useMemo(() => (today ? weekDaysOf(today) : []), [today])
  // Mémoïsé : sans ça un `new Set()` par rendu invaliderait les blocs en boucle.
  const activeDays = useMemo(
    () => activeDaysQuery.data ?? new Set<string>(),
    [activeDaysQuery.data],
  )

  const {
    poppingObjectiveId,
    startDoneSequence,
    clearDone,
    donePhaseFor,
    isVisible,
    reducedMotion,
  } = useDoneSequence()

  const visibleToday = useMemo(() => todayTasks.filter(isVisible), [todayTasks, isVisible])
  const visibleOverdue = useMemo(
    () => (overdueQuery.data ?? []).filter(isVisible),
    [overdueQuery.data, isVisible],
  )

  // `activeDays` est la vérité serveur ; le cache des tâches couvre la latence
  // d'invalidation pour que le rallumage soit immédiat au clic.
  const activeToday = useMemo(() => {
    const ids = new Set<string>()
    for (const t of todayTasksQuery.data ?? []) {
      if (t.objective_id && t.completed_at !== null) ids.add(t.objective_id)
    }
    if (today) {
      for (const objective of principals) {
        if (activeDays.has(`${objective.id}|${today}`)) ids.add(objective.id)
      }
    }
    return ids
  }, [todayTasksQuery.data, activeDays, today, principals])

  // « Vos N séances de la semaine sont faites » ne s'écrit que si c'est vrai :
  // toutes les habitudes ont atteint leur cadence.
  const habits = principals.filter((o) => o.measure === 'habitude')
  const weekComplete =
    habits.length > 0 &&
    habits.every((o) => {
      const period = weekByObjective.get(o.id)
      return !!period && period.done >= period.target
    })
  const sessionsThisWeek = habits.reduce(
    (sum, o) => sum + (weekByObjective.get(o.id)?.done ?? 0),
    0,
  )

  const ritualObjectives = ritual.pending
    ? objectivesForWeek(yearPrincipals, ritual.pending.start)
    : []
  const showRitual = ritual.pending !== null && ritualObjectives.length > 0

  // Le bilan prend le pas sur le rituel quand les deux sont ouverts : il est plus
  // rare, il se périme (un slot se libère ce soir-là), et le rituel reste
  // faisable après. Deux encarts côte à côte transformeraient deux rendez-vous en
  // arriéré — la dette que la refonte enlève.
  //
  // Le compte se fait avec les MÊMES fonctions que `BilanPage` : un trimestre
  // passe par `objectivesForQuarter` (fenêtre + date de création), l'année par
  // `objectivesForPeriod`. Compter autrement ici annoncerait « 3 objectifs » sur
  // un bilan qui n'en montrerait que deux.
  const bilanCandidates = [...yearPrincipals, ...secondaries]
  const bilanObjectives = !bilan.pending
    ? []
    : bilan.pending.period.type === 'year'
      ? objectivesForPeriod(bilanCandidates, `${bilan.pending.year}-01-01`)
      : objectivesForQuarter(
          bilanCandidates,
          bilan.pending.year,
          bilan.pending.period.quarter,
        )
  const showBilan = bilan.pending !== null && bilanObjectives.length > 0

  // Les queries de l'écran, `today` en tête puisque c'est la seule dont l'échec
  // vide vraiment le dashboard. La première en erreur donne le message.
  const queries: QueryLike[] = [
    todayQuery,
    objectivesQuery,
    todayTasksQuery,
    overdueQuery,
    periodsQuery,
    progressQuery,
    milestonesQuery,
    activeDaysQuery,
    listsQuery,
  ]

  // L'échec du rituel n'est pas retentable ici (le hook porte ses propres
  // queries) mais il doit se voir : sans lui, l'encart disparaîtrait en silence.
  const { firstError, retrying, onRetry } = useQueriesState(queries, ritual.error)

  function handleToggle(task: Task) {
    const completing = task.completed_at === null
    toggleTask.mutate(
      { id: task.id, completed: completing },
      // Le rollback de `onMutate` remet la tâche à non cochée : elle doit
      // réapparaître sans animation résiduelle.
      { onError: () => clearDone(task.id) },
    )
    // Décocher ne joue rien : seule la complétion se célèbre.
    if (completing) startDoneSequence(task)
  }

  function handleToggleImportant(task: Task) {
    updateTask.mutate({
      id: task.id,
      edits: { is_important: !task.is_important },
    })
  }

  // Seul `today` bloque le rendu : year/quarter/currentWeek en dérivent. Les
  // autres queries se dégradent proprement (`?? []`, Map/Set vides) — les
  // ajouter ici ferait clignoter tout l'écran à chaque invalidation post-toggle.
  if (todayQuery.isPending) {
    return <PageLoading />
  }

  if (todayQuery.isError) {
    return (
      <PageError
        title="Impossible de charger le dashboard"
        error={todayQuery.error}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4.5">
      <h1 className="sr-only">Dashboard</h1>

      <DashboardToolbar onOpenSettings={() => setSettingsOpen(true)} />

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}

      {showBilan && bilan.pending ? (
        <BilanCard
          year={bilan.pending.year}
          period={bilan.pending.period}
          objectiveCount={bilanObjectives.length}
        />
      ) : (
        showRitual &&
        ritual.pending && (
          <RitualCard
            weekNo={ritual.pending.week.isoWeek}
            weekStart={ritual.pending.start}
            objectiveCount={ritualObjectives.length}
          />
        )
      )}

      {prefs.showObjectives && (
        <ObjectivesBlock
          objectives={principals}
          weekByObjective={weekByObjective}
          progressByObjective={progressQuery.data ?? new Map()}
          milestonesByObjective={milestonesByObjective}
          activeDays={activeDays}
          activeToday={activeToday}
          weekDays={weekDays}
          today={today!}
          privacy={privacy}
          poppingObjectiveId={poppingObjectiveId}
        />
      )}

      {/* « Aujourd'hui » et « En retard » se partagent une ligne en desktop :
          deux listes courtes empilées laissaient un dashboard tout en hauteur
          pour trois tâches. Deux colonnes **seulement si les deux blocs
          existent** — les tâches en retard sont l'exception, pas la règle, et
          une colonne vide à droite ferait lire l'absence de retard comme un
          trou. Le conteneur n'est pas rendu du tout quand aucun des deux n'est
          là : un div vide dans une colonne `gap` laisse quand même son écart. */}
      {(prefs.showToday || visibleOverdue.length > 0) && (
        <div
          className={cn(
            'grid min-w-0 items-start gap-4.5',
            prefs.showToday && visibleOverdue.length > 0 && 'lg:grid-cols-2',
          )}
        >
          {prefs.showToday && (
            <TodayBlock
              tasks={visibleToday}
              objectives={objectiveById}
              lists={listById}
              onToggle={handleToggle}
              onToggleImportant={handleToggleImportant}
              hasObjectives={principals.length > 0}
              weekComplete={weekComplete}
              sessionsThisWeek={sessionsThisWeek}
              donePhaseFor={donePhaseFor}
              reducedMotion={reducedMotion}
            />
          )}

          <OverdueCard
            tasks={visibleOverdue}
            objectives={objectiveById}
            lists={listById}
            onToggle={handleToggle}
            onToggleImportant={handleToggleImportant}
            donePhaseFor={donePhaseFor}
            reducedMotion={reducedMotion}
          />
        </div>
      )}

      <DashboardSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
