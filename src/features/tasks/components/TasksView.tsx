import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Spinner } from '../../../components/ui/Spinner'
import { useAppDayStart, useAppToday } from '../../../hooks/useAppToday'
import { useDoneSequence } from '../../../hooks/useDoneSequence'
import { useLists } from '../../../hooks/useLists'
import { useNewTask } from '../../../hooks/useNewTask'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useObjectiveWeeks, indexWeeks } from '../../../hooks/useObjectiveWeeks'
import { selectPrincipals, useObjectives } from '../../../hooks/useObjectives'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { useToggleTask } from '../../../hooks/useToggleTask'
import {
  useDeleteTask,
  usePostponeOverdue,
  useReorderTasks,
  useUpdateTask,
} from '../../../hooks/useTaskMutations'
import {
  daysOfWeek as weekDaysOf,
  formatDayHeader,
  isoWeek,
  quarterBounds,
  year as yearOf,
  type IsoDate,
} from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { ListManagerModal } from './ListManagerModal'
import { MobileViewSheet } from './MobileViewSheet'
import { OverdueSection } from './OverdueSection'
import { DoneSection } from './DoneSection'
import { TaskEditModal } from './TaskEditModal'
import { TaskListRow } from './TaskListRow'
import { TaskRowCompact } from './TaskRowCompact'
import { TasksEmpty } from './TasksEmpty'
import { TasksCardHeaderMobile } from './TasksCardHeaderMobile'
import { TasksHeader } from './TasksHeader'
import { TasksToolbar } from './TasksToolbar'
import { DEFAULT_SORT, sortTasks, type SortMode } from '../taskSort'
import {
  inOverdueScope,
  isDayScope,
  isPastDue,
  matchesScope,
  matchesSearch,
  pendingCount,
  SCOPE_TITLES,
  type DateBucket,
} from '../taskScope'
import { parseTaskParams, withLists, withoutLists } from '../taskViewParams'
import { useTaskDrag } from '../useTaskDrag'

export function TasksView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { scope, listId, listsOpen } = parseTaskParams(searchParams)
  // La modale de création est montée globalement par `NewTaskHost` : cet écran ne
  // fait que demander son ouverture.
  const { openNewTask } = useNewTask()

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

  // Une seule requête pour tout l'écran : les compteurs de la feuille mobile
  // couvrent toutes les vues, et la recherche porte sur l'ensemble. Cinq requêtes
  // filtrées re-téléchargeraient les mêmes lignes et pourraient se contredire
  // pendant une invalidation.
  const tasksQuery = useTasks('all', { completedSince: dayStart })
  const listsQuery = useLists()
  const objectivesQuery = useObjectives(year)

  const principals = useMemo(() => selectPrincipals(objectivesQuery.data), [objectivesQuery.data])
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])
  const weeksQuery = useObjectiveWeeks(principalIds, currentWeek?.isoYear)
  const activeDaysQuery = useObjectiveActiveDays(principalIds, quarterRange?.from, quarterRange?.to)

  const toggleTask = useToggleTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const reorderTasks = useReorderTasks()
  const postponeOverdue = usePostponeOverdue()

  // --- État d'écran. Rien n'est mémorisé : la SPEC §5 l'interdit -------------
  const [sortOverride, setSortOverride] = useState<SortMode | null>(null)
  const [search, setSearch] = useState('')
  const [mobileViewOpen, setMobileViewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Les vues multi-jours se lisent par compartiment (maquette v2) : les tâches
  // datées, groupées par jour, ou celles qui n'ont pas d'échéance. « Daté » par
  // défaut — c'est la lecture chronologique, celle qui répond à « et ensuite ? ».
  const [dateBucket, setDateBucket] = useState<DateBucket>('dated')

  // Changer de vue remet le tri et la recherche à leur défaut : ils ne suivent pas.
  useEffect(() => {
    setSortOverride(null)
    setSearch('')
    setDateBucket('dated')
  }, [scope, listId])

  const sort = sortOverride ?? DEFAULT_SORT
  // Une vue multi-jours groupe ses lignes par échéance : le tri par date de la v1
  // y est devenu implicite, et les tâches sans date ferment la marche.
  const grouped = !isDayScope(scope)

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
  const weekIndex = useMemo(() => indexWeeks(weeksQuery.data), [weeksQuery.data])
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

  // Le retard vit hors de la portée de la vue : il a sa propre section partout.
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

  // Les compteurs des deux compartiments portent sur la portée entière, pas sur
  // le compartiment affiché : sinon l'onglet inactif afficherait toujours zéro.
  const datedCount = useMemo(
    () => displayedMain.filter((t) => t.due_date !== null).length,
    [displayedMain],
  )
  const bucketCounts = { dated: datedCount, undated: displayedMain.length - datedCount }

  const bucketed = useMemo(
    () =>
      grouped
        ? displayedMain.filter((t) => (t.due_date === null) === (dateBucket === 'undated'))
        : displayedMain,
    [displayedMain, grouped, dateBucket],
  )

  // --- Cartes d'objectif : allumées si l'objectif a avancé aujourd'hui -------
  const objectivesActiveToday = useMemo(() => {
    const ids = new Set<string>()
    for (const t of allTasks) {
      if (t.objective_id && t.completed_at !== null && t.due_date === today) ids.add(t.objective_id)
    }
    return ids
  }, [allTasks, today])

  const isLit = useCallback(
    (objective: (typeof principals)[number]) =>
      objective.closed_at !== null ||
      objectivesActiveToday.has(objective.id) ||
      (!!today && activeDays.has(`${objective.id}|${today}`)),
    [objectivesActiveToday, activeDays, today],
  )

  // --- Actions ---------------------------------------------------------------
  function handleToggle(task: Task) {
    const completing = task.completed_at === null
    toggleTask.mutate(
      { id: task.id, completed: completing },
      { onError: () => clearDone(task.id) },
    )
    // Décocher ne joue rien : seule la complétion se célèbre.
    if (completing) startDoneSequence(task)
  }

  // Les modales vivent dans l'URL : la sidebar et la barre d'onglets peuvent les
  // ouvrir sans importer quoi que ce soit de la feature, et le lien est partageable.
  function openLists() {
    setSearchParams(withLists(searchParams))
  }

  function closeLists() {
    setSearchParams(withoutLists(searchParams), { replace: true })
  }

  const editingTask = editingId ? (allTasks.find((t) => t.id === editingId) ?? null) : null

  // --- Chargement et erreurs (modèle DashboardView) -------------------------
  type QueryLike = { error: Error | null; isFetching: boolean; refetch: () => Promise<unknown> }
  const queries: QueryLike[] = [
    todayQuery,
    dayStartQuery,
    tasksQuery,
    listsQuery,
    objectivesQuery,
    weeksQuery,
    activeDaysQuery,
  ]
  const failed = queries.filter((q) => q.error !== null)
  const firstError = failed[0]?.error ?? null
  const retrying = failed.some((q) => q.isFetching)

  const writeError =
    toggleTask.error ?? updateTask.error ?? deleteTask.error ?? reorderTasks.error ?? postponeOverdue.error

  function handleRetry() {
    for (const query of failed) void query.refetch()
  }

  if (todayQuery.isPending || dayStartQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-ink-muted" />
      </div>
    )
  }

  if (todayQuery.isError || dayStartQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <ErrorState
          title="Impossible de charger vos tâches"
          description={dataErrorMessage(todayQuery.error ?? dayStartQuery.error)}
          onRetry={handleRetry}
          retrying={retrying}
          className="max-w-md"
        />
      </div>
    )
  }

  const anchor = today as IsoDate
  const title = scope === 'list' ? (selectedList?.name ?? 'Liste') : SCOPE_TITLES[scope]

  // Sur `bucketed`, pas sur `displayedMain` : basculer vers un compartiment vide
  // doit donner l'état vide, pas une carte blanche.
  const emptyList = bucketed.length === 0 && overdueTasks.length === 0

  // Les actions d'une ligne, en un seul endroit : la section « en retard » et la
  // liste principale rendent les mêmes composants, elles doivent réagir pareil —
  // les écrire deux fois, c'est n'en faire évoluer qu'une.
  const rowActions = {
    lists,
    today: anchor,
    reducedMotion,
    onToggle: handleToggle,
    onRename: (t: Task, value: string) => updateTask.mutate({ id: t.id, edits: { title: value } }),
    onToggleImportant: (t: Task) =>
      updateTask.mutate({ id: t.id, edits: { is_important: !t.is_important } }),
    onPickList: (t: Task, value: string | null) =>
      updateTask.mutate({ id: t.id, edits: { list_id: value } }),
    onPickDue: (t: Task, value: IsoDate | null) =>
      updateTask.mutate({ id: t.id, edits: { due_date: value } }),
    onOpen: (t: Task) => setEditingId(t.id),
    onDelete: (t: Task) => deleteTask.mutate(t.id),
  }

  const overdueProps = {
    tasks: overdueTasks,
    objectiveSlotOf,
    listById,
    onPostponeAll: () => postponeOverdue.mutate(),
    postponing: postponeOverdue.isPending,
    donePhaseFor,
  }
  const doneProps = { tasks: doneTasks, objectiveSlotOf, onToggle: handleToggle }

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <TasksHeader
        title={title}
        onManageLists={scope === 'list' ? () => openLists() : undefined}
      />

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}
      {writeError && <ErrorState description={dataErrorMessage(writeError)} />}

      {principals.length > 0 && (
        <section className="hidden lg:block">
          <h2 className="mb-2 text-[10px] font-semibold tracking-[1.3px] text-ink-muted">
            VOS OBJECTIFS
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {principals.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                week={weekIndex.get(`${objective.id}|${currentWeek!.isoWeek}`)}
                activeDays={activeDays}
                milestones={[]}
                daysOfWeek={weekDaysOf(anchor)}
                today={anchor}
                compact
                lit={isLit(objective)}
                popping={poppingObjectiveId === objective.id}
              />
            ))}
          </div>
        </section>
      )}

      <div className="rounded-[18px] bg-surface px-3.5 py-3 shadow-card lg:rounded-2xl lg:p-5">
        <TasksCardHeaderMobile
          scope={scope}
          dayCounts={{
            today: pendingCount(allTasks, 'today', { today: anchor }),
            tomorrow: pendingCount(allTasks, 'tomorrow', { today: anchor }),
          }}
          bucket={dateBucket}
          onBucketChange={setDateBucket}
          bucketCounts={bucketCounts}
          onOpenFilters={() => setMobileViewOpen(true)}
        />

        <TasksToolbar
          scope={scope}
          title={title}
          dayCounts={{
            today: pendingCount(allTasks, 'today', { today: anchor }),
            tomorrow: pendingCount(allTasks, 'tomorrow', { today: anchor }),
          }}
          bucket={dateBucket}
          onBucketChange={setDateBucket}
          bucketCounts={bucketCounts}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSortOverride}
          onCreate={openNewTask}
        />

        {/* Le retard vit désormais dans la carte aux deux largeurs (maquette v2). */}
        {overdueTasks.length > 0 && (
          <>
            <OverdueSection {...overdueProps} {...rowActions} />
            <div className="my-3 h-px bg-border lg:my-4" />
          </>
        )}

        {emptyList ? (
          <TasksEmpty
            searching={searching}
            hasObjectives={(objectivesQuery.data?.length ?? 0) > 0}
            onCreate={openNewTask}
          />
        ) : (
          <>
            <ul className="hidden flex-col lg:flex">
              {bucketed.map((task, index) => {
                const previous = bucketed[index - 1]
                const dayHeader =
                  grouped && task.due_date !== null && task.due_date !== previous?.due_date

                return (
                  <Fragment key={task.id}>
                    {dayHeader && (
                      <li
                        aria-hidden
                        className={cn(
                          'px-1 pb-1.5 text-[9.5px] font-semibold tracking-[1.3px] text-ink-muted',
                          index === 0 ? 'pt-1' : 'pt-4',
                        )}
                      >
                        {formatDayHeader(task.due_date as IsoDate)}
                      </li>
                    )}
                    <TaskListRow
                      {...rowActions}
                      task={task}
                      objectiveSlot={objectiveSlotOf(task)}
                      list={task.list_id ? listById.get(task.list_id) : undefined}
                      canDrag={canDrag}
                      dragging={drag.dragId === task.id}
                      grabbed={drag.grabbedId === task.id}
                      donePhase={donePhaseFor(task.id)}
                      onGripPointerDown={drag.onGripPointerDown}
                      onGripKeyDown={drag.onGripKeyDown}
                    />
                  </Fragment>
                )
              })}
            </ul>

            {/* Le mobile ne groupe pas : la maquette y garde une liste plate. */}
            <ul className="flex flex-col lg:hidden">
              {bucketed.map((task) => (
                <TaskRowCompact
                  key={task.id}
                  task={task}
                  objectiveSlot={objectiveSlotOf(task)}
                  list={task.list_id ? listById.get(task.list_id) : undefined}
                  donePhase={donePhaseFor(task.id)}
                  reducedMotion={reducedMotion}
                  onToggle={handleToggle}
                  onOpen={(t) => setEditingId(t.id)}
                />
              ))}
            </ul>
          </>
        )}

        <DoneSection {...doneProps} />
      </div>

      {/* Le déplacement au clavier n'a aucun retour visuel pour un lecteur d'écran. */}
      <p role="status" aria-live="polite" className="sr-only">
        {drag.announcement}
      </p>

      <TaskEditModal
        task={editingTask}
        onClose={() => setEditingId(null)}
        principals={principals}
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
        counts={{
          today: pendingCount(allTasks, 'today', { today: anchor }),
          week: pendingCount(allTasks, 'week', { today: anchor }),
          all: pendingCount(allTasks, 'all', { today: anchor }),
        }}
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
