import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorState } from '../../../components/ui/ErrorState'
import { useAppDayStart, useAppToday } from '../../../hooks/useAppToday'
import { useDoneSequence } from '../../../hooks/useDoneSequence'
import { useLists } from '../../../hooks/useLists'
import { useNewTask } from '../../../hooks/useNewTask'
import { usePrivacy } from '../../../hooks/usePrivacy'
import { groupByObjective, useMilestones } from '../../../hooks/useMilestones'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useObjectiveProgress, type ObjectiveProgress } from '../../../hooks/useObjectiveProgress'
import {
  useObjectivePeriods,
  indexPeriods,
  periodKey,
  type ObjectivePeriod,
} from '../../../hooks/useObjectivePeriods'
import { selectPrincipals, useObjectives } from '../../../hooks/useObjectives'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { useToggleTask } from '../../../hooks/useToggleTask'
import {
  useDeleteTask,
  usePostponeOverdue,
  useUndateOverdue,
  useReorderTasks,
  useUpdateTask,
} from '../../../hooks/useTaskMutations'
import {
  daysOfWeek as weekDaysOf,
  isoWeek,
  quarterBounds,
  quarterOf,
  year as yearOf,
  type IsoDate,
} from '../../../lib/appDate'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { DEFAULT_LIST_COLOR } from '../../../lib/listPalette'
import { isWithinWindow } from '../../../lib/objectiveFeasibility'
import { DoneSection } from '../components/DoneSection'
import { ListManagerModal } from '../components/ListManagerModal'
import { MobileViewSheet } from '../components/MobileViewSheet'
import { OverdueSection } from '../components/OverdueSection'
import { TaskEditModal } from '../components/TaskEditModal'
import { TaskList, type TaskRowActions } from '../components/TaskList'
import { TasksCardHeaderMobile } from '../components/TasksCardHeaderMobile'
import { TasksEmpty } from '../components/TasksEmpty'
import { TasksHeader } from '../components/TasksHeader'
import { TasksObjectiveStrip } from '../components/TasksObjectiveStrip'
import { TasksToolbar } from '../components/TasksToolbar'
import type { ScopeCounts } from '../components/TaskViewSwitcher'
import { taskAge } from '../../../lib/taskAge'
import { DEFAULT_SORT, sortTasks, type SortMode } from '../taskSort'
import {
  inOverdueScope,
  isFlatScope,
  isPastDue,
  matchesScope,
  matchesSearch,
  pendingCount,
  SCOPE_ORDER,
  SCOPE_TITLES,
} from '../taskScope'
import { parseTaskParams, withLists, withoutLists } from '../taskViewParams'
import { useTaskDrag } from '../useTaskDrag'
import { useQueriesState, type QueryLike } from '../../../hooks/useQueriesState'
import { PageLoading } from '../../../components/layout/PageState'

/**
 * L'écran Tâches. Le fetching et l'état d'écran vivent ici, les bandes sont
 * muettes et reçoivent leurs données en props — même forme que `HomePage` et
 * `ObjectivesPage`.
 */
export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { scope, listId, listsOpen } = parseTaskParams(searchParams)
  // La modale de création est montée globalement par `NewTaskHost` : cet écran ne
  // fait que demander son ouverture.
  const { openNewTask } = useNewTask()
  // Seule la bande d'objectifs se masque ici : les titres de tâches et les noms
  // de listes restent lisibles, sinon l'écran n'est plus utilisable du tout.
  const { privacy } = usePrivacy()

  // Toute la page s'ancre sur la date du serveur : rien ne dépend de l'horloge
  // du navigateur (SPEC §2 — le fuseau est unique pour tous).
  const todayQuery = useAppToday()
  const today = todayQuery.data

  // Borne de la section « Terminées » : une tâche cochée reste à l'écran
  // jusqu'à la fin du jour (SPEC §5), pas au-delà. La borne porte sur
  // `completed_at`, un timestamptz — seul le serveur connaît le fuseau.
  const dayStartQuery = useAppDayStart()
  const dayStart = dayStartQuery.data

  const year = today ? yearOf(today) : undefined
  const currentWeek = today ? isoWeek(today) : undefined
  const quarterRange = today ? quarterBounds(today) : undefined
  const quarter = today ? quarterOf(today) : undefined

  // Une seule requête pour tout l'écran : les compteurs des quatre vues portent
  // sur l'ensemble, et la recherche aussi. Quatre requêtes filtrées
  // re-téléchargeraient les mêmes lignes et pourraient se contredire pendant
  // une invalidation.
  const tasksQuery = useTasks('all', { completedSince: dayStart })
  const listsQuery = useLists()
  const objectivesQuery = useObjectives(year)

  const yearPrincipals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  // La bande ne montre que les objectifs de la fenêtre en cours, comme le
  // dashboard : un objectif pris pour le trimestre prochain ne rappelle rien
  // aujourd'hui. Le choix d'objectif d'une tâche, lui, garde l'année entière —
  // une tâche peut être écrite à l'avance pour une fenêtre qui vient.
  const principals = useMemo(
    () => (today ? yearPrincipals.filter((o) => isWithinWindow(o, today)) : []),
    [yearPrincipals, today],
  )
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])
  const weeksQuery = useObjectivePeriods(principalIds, 'week', currentWeek?.isoYear)
  // La bande partage `ObjectiveCard` avec le dashboard : sans les jalons ni la
  // progression, un objectif jalonné y afficherait « 0 / 0 » et un objectif
  // quantifié un montant nul. La carte dirait faux.
  const milestonesQuery = useMilestones(principalIds, year, quarter)
  const progressQuery = useObjectiveProgress(principalIds)
  const activeDaysQuery = useObjectiveActiveDays(principalIds, quarterRange?.from, quarterRange?.to)

  const toggleTask = useToggleTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const reorderTasks = useReorderTasks()
  const postponeOverdue = usePostponeOverdue()
  const undateOverdue = useUndateOverdue()

  // --- État d'écran. Rien n'est mémorisé : la SPEC §5 l'interdit -------------
  const [sortOverride, setSortOverride] = useState<SortMode | null>(null)
  const [search, setSearch] = useState('')
  const [mobileViewOpen, setMobileViewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Changer de vue remet le tri et la recherche à leur défaut : ils ne suivent pas.
  useEffect(() => {
    setSortOverride(null)
    setSearch('')
  }, [scope, listId])

  const sort = sortOverride ?? DEFAULT_SORT
  // Une vue multi-jours groupe ses lignes par échéance : le tri par date de la v1
  // y est devenu implicite. « Aujourd'hui » et « Sans date » restent plates.
  const grouped = !isFlatScope(scope)

  const {
    poppingObjectiveId,
    startDoneSequence,
    clearDone,
    donePhaseFor,
    isVisible,
    reducedMotion,
  } = useDoneSequence()

  // --- Index de rendu (les vues n'ont pas de métadonnée de clé étrangère) ----
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  const lists = useMemo(() => listsQuery.data ?? [], [listsQuery.data])
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])
  const objectiveById = useMemo(
    () => new Map((objectivesQuery.data ?? []).map((o) => [o.id, o])),
    [objectivesQuery.data],
  )
  // Le relevé de la semaine en cours, ramené à une clé par objectif : la bande
  // n'a pas à connaître `periodKey` ni l'année ISO courante.
  const weekByObjective = useMemo(() => {
    const byObjective = new Map<string, ObjectivePeriod>()
    if (!currentWeek) return byObjective
    const periods = indexPeriods(weeksQuery.data)
    for (const id of principalIds) {
      const week = periods.get(periodKey(id, 'week', currentWeek.isoYear, currentWeek.isoWeek))
      if (week) byObjective.set(id, week)
    }
    return byObjective
  }, [weeksQuery.data, principalIds, currentWeek])
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )
  const progressByObjective = useMemo(
    () => progressQuery.data ?? new Map<string, ObjectiveProgress>(),
    [progressQuery.data],
  )
  const activeDays = useMemo(() => activeDaysQuery.data ?? new Set<string>(), [activeDaysQuery.data])

  const objectiveSlotOf = useCallback(
    (task: Task) => (task.objective_id ? objectiveById.get(task.objective_id)?.slot : null),
    [objectiveById],
  )

  const selectedList = listId ? listById.get(listId) : undefined

  // --- Découpage de la portée en trois blocs (maquette) ----------------------
  const scoped = useMemo(
    () => (today ? allTasks.filter((t) => matchesScope(t, scope, { today, listId })) : []),
    [allTasks, scope, listId, today],
  )

  const searching = search.trim().length > 0

  // Le retard vit hors de la portée de la vue : il a sa propre section partout,
  // sauf dans le pool — une tâche en retard porte une échéance.
  const overdueTasks = useMemo(
    () =>
      today
        ? allTasks.filter(
            (t) =>
              inOverdueScope(t, scope, { today, listId }) &&
              isVisible(t) &&
              matchesSearch(t, search),
          )
        : [],
    [allTasks, scope, listId, today, isVisible, search],
  )

  const mainTasks = useMemo(
    () =>
      today
        ? scoped.filter((t) => !isPastDue(t, today) && isVisible(t) && matchesSearch(t, search))
        : [],
    [scoped, today, isVisible, search],
  )

  // La borne « fin du jour » est déjà posée par la requête (`completedSince`) :
  // rien de plus ancien n'arrive jusqu'ici. Ne restent que les cochées du jour,
  // moins celles qui jouent encore leur animation de sortie.
  const doneTasks = useMemo(
    () => (searching ? [] : scoped.filter((t) => t.completed_at !== null && !donePhaseFor(t.id))),
    [scoped, searching, donePhaseFor],
  )

  const sortedMain = useMemo(
    () => sortTasks(mainTasks, sort, { groupByDate: grouped }),
    [mainTasks, sort, grouped],
  )
  const mainIds = useMemo(() => sortedMain.map((t) => t.id), [sortedMain])
  const titleOf = useCallback(
    (id: string) => allTasks.find((t) => t.id === id)?.title ?? 'Tâche',
    [allTasks],
  )

  // Positions serveur d'avant le glissement : la mutation en a besoin pour
  // n'écrire que les lignes qui bougent (son `onMutate` réécrit déjà le cache).
  const positionById = useMemo(
    () => new Map(sortedMain.map((t) => [t.id, t.position])),
    [sortedMain],
  )

  // Pas de poignée là où l'échéance impose déjà l'ordre : glisser une ligne d'un
  // jour vers un autre la ramènerait aussitôt dans son groupe.
  const canDrag = sort === 'manual' && !searching && !grouped
  const drag = useTaskDrag({
    ids: mainIds,
    enabled: canDrag,
    titleOf,
    onCommit: (orderedIds) => reorderTasks.mutate({ orderedIds, positions: positionById }),
  })

  const displayedMain = useMemo(() => {
    const byId = new Map(sortedMain.map((t) => [t.id, t]))
    return drag.order.map((id) => byId.get(id)).filter((t): t is Task => !!t)
  }, [drag.order, sortedMain])

  // --- Cartes d'objectif : allumées si l'objectif a avancé aujourd'hui -------
  const activeToday = useMemo(() => {
    const ids = new Set<string>()
    for (const t of allTasks) {
      if (t.objective_id && t.completed_at !== null && t.due_date === today) ids.add(t.objective_id)
    }
    // `activeDays` vient du serveur : il couvre les jours crédités qu'aucune
    // tâche du cache ne raconte (saisie d'un objectif quantifié, tâche datée
    // d'hier cochée aujourd'hui).
    if (today) for (const id of principalIds) if (activeDays.has(`${id}|${today}`)) ids.add(id)
    return ids
  }, [allTasks, today, principalIds, activeDays])

  // --- Actions ---------------------------------------------------------------
  const handleToggle = useCallback(
    (task: Task) => {
      const completing = task.completed_at === null
      toggleTask.mutate(
        { id: task.id, completed: completing },
        { onError: () => clearDone(task.id) },
      )
      // Décocher ne joue rien : seule la complétion se célèbre.
      if (completing) startDoneSequence(task)
    },
    [toggleTask, clearDone, startDoneSequence],
  )

  // Les modales vivent dans l'URL : la sidebar et la barre d'onglets peuvent les
  // ouvrir sans importer quoi que ce soit de la feature, et le lien est partageable.
  function openLists() {
    setSearchParams(withLists(searchParams))
  }

  function closeLists() {
    setSearchParams(withoutLists(searchParams), { replace: true })
  }

  const editingTask = editingId ? (allTasks.find((t) => t.id === editingId) ?? null) : null

  // --- Chargement et erreurs (même modèle que HomePage) ----------------------
  const queries: QueryLike[] = [
    todayQuery,
    dayStartQuery,
    tasksQuery,
    listsQuery,
    objectivesQuery,
    weeksQuery,
    activeDaysQuery,
    milestonesQuery,
    progressQuery,
  ]
  // Mémoïsé, et au-dessus des sorties anticipées : `pendingCount` balaie tout
  // `allTasks` une fois par vue, donc quatre fois — à chaque frappe du champ de
  // recherche, dont l'état vit dans ce composant.
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SCOPE_ORDER.map((candidate) => [
          candidate,
          today ? pendingCount(allTasks, candidate, { today, listId }) : 0,
        ]),
      ) as ScopeCounts,
    [allTasks, today, listId],
  )

  const { firstError, retrying, onRetry } = useQueriesState(queries)

  const writeError =
    toggleTask.error ??
    updateTask.error ??
    deleteTask.error ??
    reorderTasks.error ??
    postponeOverdue.error ??
    undateOverdue.error

  if (todayQuery.isPending || dayStartQuery.isPending) {
    return (
      <PageLoading />
    )
  }

  if (todayQuery.isError || dayStartQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <ErrorState
          title="Impossible de charger vos tâches"
          description={dataErrorMessage(todayQuery.error ?? dayStartQuery.error)}
          onRetry={onRetry}
          retrying={retrying}
          className="max-w-md"
        />
      </div>
    )
  }

  const anchor = today as IsoDate
  // Le titre nomme la liste quand il y en a une : les onglets, juste en dessous,
  // disent déjà la portée. Le repli sur « Liste » couvre le temps de chargement
  // des listes — sans lui, l'en-tête annoncerait brièvement la mauvaise vue.
  const title = listId ? (selectedList?.name ?? 'Liste') : SCOPE_TITLES[scope]
  const listColor = listId ? (selectedList?.color ?? DEFAULT_LIST_COLOR) : null

  // L'âge ne se lit que dans le pool : ailleurs, l'échéance dit déjà de quand
  // date la ligne (REFONTE §5).
  const ageOf = (task: Task) => (scope === 'undated' ? taskAge(task, anchor) : null)

  const emptyList = displayedMain.length === 0 && overdueTasks.length === 0

  // Les actions d'une ligne, en un seul endroit : la section « en retard » et la
  // liste principale rendent les mêmes composants, elles doivent réagir pareil —
  // les écrire deux fois, c'est n'en faire évoluer qu'une.
  const rowActions: TaskRowActions = {
    lists,
    today: anchor,
    reducedMotion,
    onToggle: handleToggle,
    onToggleImportant: (t) =>
      updateTask.mutate({ id: t.id, edits: { is_important: !t.is_important } }),
    onPickList: (t, value) => updateTask.mutate({ id: t.id, edits: { list_id: value } }),
    onPickDue: (t, value) => updateTask.mutate({ id: t.id, edits: { due_date: value } }),
    onOpen: (t) => setEditingId(t.id),
    onDelete: (t) => deleteTask.mutate(t.id),
  }

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <TasksHeader
        title={title}
        color={listColor}
        onManageLists={listId ? openLists : undefined}
      />

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}
      {writeError && <ErrorState description={dataErrorMessage(writeError)} />}

      <TasksObjectiveStrip
        objectives={principals}
        weekByObjective={weekByObjective}
        progressByObjective={progressByObjective}
        milestonesByObjective={milestonesByObjective}
        activeDays={activeDays}
        activeToday={activeToday}
        weekDays={weekDaysOf(anchor)}
        today={anchor}
        privacy={privacy}
        poppingObjectiveId={poppingObjectiveId}
      />

      <div className="rounded-[18px] bg-surface px-3.5 py-3 shadow-card lg:rounded-2xl lg:p-5">
        <TasksCardHeaderMobile
          scope={scope}
          listId={listId}
          counts={counts}
          onOpenFilters={() => setMobileViewOpen(true)}
        />

        <TasksToolbar
          scope={scope}
          listId={listId}
          counts={counts}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSortOverride}
          onCreate={openNewTask}
        />

        {/* Le retard vit dans la carte aux deux largeurs (maquette v2). */}
        {overdueTasks.length > 0 && (
          <>
            <OverdueSection
              {...rowActions}
              tasks={overdueTasks}
              objectiveSlotOf={objectiveSlotOf}
              listById={listById}
              onPostponeAll={() => postponeOverdue.mutate()}
              postponing={postponeOverdue.isPending}
              onUndateAll={() => undateOverdue.mutate()}
              undating={undateOverdue.isPending}
              donePhaseFor={donePhaseFor}
            />
            <div className="my-3 h-px bg-border lg:my-4" />
          </>
        )}

        {emptyList ? (
          <TasksEmpty
            scope={scope}
            listId={listId}
            searching={searching}
            hasOverdue={overdueTasks.length > 0}
            hasUndated={counts.undated > 0}
            onCreate={openNewTask}
          />
        ) : (
          <TaskList
            {...rowActions}
            tasks={displayedMain}
            objectiveSlotOf={objectiveSlotOf}
            listById={listById}
            ageOf={ageOf}
            grouped={grouped}
            canDrag={canDrag}
            donePhaseFor={donePhaseFor}
            dragId={drag.dragId}
            grabbedId={drag.grabbedId}
            onGripPointerDown={drag.onGripPointerDown}
            onGripKeyDown={drag.onGripKeyDown}
          />
        )}

        <DoneSection tasks={doneTasks} objectiveSlotOf={objectiveSlotOf} onToggle={handleToggle} />
      </div>

      {/* Le déplacement au clavier n'a aucun retour visuel pour un lecteur d'écran. */}
      <p role="status" aria-live="polite" className="sr-only">
        {drag.announcement}
      </p>

      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingId(null)}
        principals={yearPrincipals}
        lists={lists}
        today={anchor}
      />

      <ListManagerModal open={listsOpen} onClose={closeLists} lists={lists} />

      <MobileViewSheet
        open={mobileViewOpen}
        onClose={() => setMobileViewOpen(false)}
        scope={scope}
        listId={listId}
        lists={lists}
        counts={counts}
        sort={sort}
        onSortChange={setSortOverride}
        onManageLists={() => {
          setMobileViewOpen(false)
          openLists()
        }}
      />
    </div>
  )
}
