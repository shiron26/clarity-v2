import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { EyeIcon } from '../../../components/icons/EyeIcon'
import { EyeOffIcon } from '../../../components/icons/EyeOffIcon'
import { GearIcon } from '../../../components/icons/GearIcon'
import { PlusIcon } from '../../../components/icons/PlusIcon'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Spinner } from '../../../components/ui/Spinner'
import { useAppToday } from '../../../hooks/useAppToday'
import { useLists } from '../../../hooks/useLists'
import { useNewTask } from '../../../hooks/useNewTask'
import { groupByObjective, useMilestones } from '../../../hooks/useMilestones'
import { indexWeeks, useObjectiveWeeks } from '../../../hooks/useObjectiveWeeks'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { selectPrincipals, useObjectives } from '../../../hooks/useObjectives'
import { useTasks, type Task } from '../../../hooks/useTasks'
import { useToggleTask } from '../../../hooks/useToggleTask'
import { useDoneSequence } from '../../../hooks/useDoneSequence'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import {
  daysOfWeek as weekDaysOf,
  isoWeek,
  quarterBounds,
  quarterOf,
  weeksOfQuarter,
  year as yearOf,
} from '../../../lib/appDate'
import { DashboardSettingsModal } from './DashboardSettingsModal'
import { FocusTodayCard } from './FocusTodayCard'
import { ObjectiveCard } from '../../../components/objectives/ObjectiveCard'
import { ObjectiveSlotsEmpty } from './ObjectiveSlotsEmpty'
import { OverdueCard } from './OverdueCard'
import { QuarterActivity } from './QuarterActivity'
import { useTopBarSlot } from '../../../components/layout/topBarSlot'
import { useDashboardPrefs } from '../useDashboardPrefs'

export function DashboardView() {
  const { prefs, togglePref } = useDashboardPrefs()
  const topBarSlot = useTopBarSlot()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // La modale de création est montée globalement : on l'ouvre sans quitter l'accueil.
  const { openNewTask } = useNewTask()

  // Tout le dashboard s'ancre sur la date du serveur : rien ne dépend de
  // l'horloge du navigateur.
  const todayQuery = useAppToday()
  const today = todayQuery.data

  const year = today ? yearOf(today) : undefined
  const quarter = today ? quarterOf(today) : undefined
  const currentWeek = today ? isoWeek(today) : undefined

  const objectivesQuery = useObjectives(year)
  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const principalIds = useMemo(() => principals.map((o) => o.id), [principals])

  const weeksQuery = useObjectiveWeeks(principalIds, currentWeek?.isoYear)
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

  const toggleTask = useToggleTask()

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
  const weekIndex = useMemo(() => indexWeeks(weeksQuery.data), [weeksQuery.data])
  const milestonesByObjective = useMemo(
    () => groupByObjective(milestonesQuery.data),
    [milestonesQuery.data],
  )

  // Les tâches reliées à un objectif remontent en tête : ce sont celles qui
  // font avancer quelque chose.
  const todayTasks = useMemo(() => {
    return [...(todayTasksQuery.data ?? [])].sort((a, b) => {
      const linked = Number(!!b.objective_id) - Number(!!a.objective_id)
      return linked !== 0 ? linked : a.position - b.position
    })
  }, [todayTasksQuery.data])

  const weekDays = today ? weekDaysOf(today) : []
  const quarterWeeks = today ? weeksOfQuarter(today) : []
  // Mémoïsé : sans ça un `new Set()` par rendu invaliderait `isLit` en boucle.
  const activeDays = useMemo(
    () => activeDaysQuery.data ?? new Set<string>(),
    [activeDaysQuery.data],
  )

  // --- Séquence de complétion (chronométrage de la maquette) -----------------
  // Une tâche cochée reste en place le temps du flash et du repli, puis quitte
  // la liste. `poppingObjectiveId` rallume la carte de l'objectif au même moment.
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

  // Une carte est en couleur si l'objectif a avancé aujourd'hui. `activeDays`
  // est la vérité serveur ; le cache des tâches couvre la latence d'invalidation
  // pour que le rallumage soit immédiat au clic.
  const objectivesActiveToday = useMemo(() => {
    const ids = new Set<string>()
    for (const t of todayTasksQuery.data ?? []) {
      if (t.objective_id && t.completed_at !== null) ids.add(t.objective_id)
    }
    return ids
  }, [todayTasksQuery.data])

  const isLit = useCallback(
    (objective: (typeof principals)[number]) =>
      objective.closed_at !== null ||
      objectivesActiveToday.has(objective.id) ||
      (!!today && activeDays.has(`${objective.id}|${today}`)),
    [objectivesActiveToday, activeDays, today],
  )

  // Les huit queries de l'écran, `today` en tête puisque c'est la seule dont
  // l'échec vide vraiment le dashboard. La première en erreur donne le message.
  // Type structurel : les huit `UseQueryResult<T>` n'ont pas de type nominal
  // commun, et on n'a besoin ici que de ces trois membres.
  type QueryLike = {
    error: Error | null
    isFetching: boolean
    refetch: () => Promise<unknown>
  }

  const queries: QueryLike[] = [
    todayQuery,
    objectivesQuery,
    todayTasksQuery,
    overdueQuery,
    weeksQuery,
    milestonesQuery,
    activeDaysQuery,
    listsQuery,
  ]

  const failed = queries.filter((q) => q.error !== null)
  const firstError = failed[0]?.error ?? null
  const retrying = failed.some((q) => q.isFetching)

  function handleRetry() {
    // Ne relancer que ce qui a échoué : les queries saines gardent leur cache.
    for (const query of failed) void query.refetch()
  }

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

  // Seul `today` bloque le rendu : year/quarter/currentWeek en dérivent. Les
  // sept autres queries se dégradent proprement (`?? []`, Map/Set vides) — les
  // ajouter ici ferait clignoter tout l'écran à chaque invalidation post-toggle.
  if (todayQuery.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-ink-muted" />
      </div>
    )
  }

  // `today` en erreur : plus d'ancre, et toute la cascade en aval reste
  // `enabled: false`. Afficher l'erreur seule plutôt qu'un squelette vide.
  if (todayQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center px-5">
        <ErrorState
          title="Impossible de charger le dashboard"
          description={dataErrorMessage(todayQuery.error)}
          onRetry={handleRetry}
          retrying={retrying}
          className="max-w-md"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Dashboard</h1>

      {/* Sous `lg`, ces deux réglages remontent dans la barre mobile (portail
          ci-dessous) et « Nouvelle tâche » disparaît : le bouton flottant de la
          barre d'onglets fait déjà le travail. La rangée entière s'efface, ce qui
          rend une pleine ligne à l'écran. */}
      <div className="hidden justify-end gap-2.5 lg:flex">
        <button
          type="button"
          onClick={() => togglePref('privacy')}
          aria-pressed={prefs.privacy}
          title="Masquer les objectifs"
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 py-2 text-body font-medium transition-colors duration-150',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            prefs.privacy
              ? 'border-[#a9beff] bg-primary-soft text-primary'
              : 'border-border bg-surface text-ink-2 hover:border-[#a9beff] hover:text-primary',
          )}
        >
          {prefs.privacy ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
          <span className="hidden sm:inline">{prefs.privacy ? 'Masqué' : 'Masquer'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          title="Paramétrer le dashboard"
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-body font-medium text-ink-2 transition-colors duration-150 hover:border-[#a9beff] hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <GearIcon className="size-3.5" />
          <span className="hidden sm:inline">Réglages</span>
        </button>

        <Button onClick={openNewTask} title="Raccourci : N" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          Nouvelle tâche
        </Button>
      </div>

      {/* Mêmes réglages, rendus dans la barre mobile à côté de la déconnexion.
          Ils s'alignent sur son bouton — icône nue, pas de cartouche bordée. */}
      {topBarSlot &&
        createPortal(
          <>
            <button
              type="button"
              onClick={() => togglePref('privacy')}
              aria-pressed={prefs.privacy}
              aria-label="Masquer les objectifs"
              title="Masquer les objectifs"
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150',
                'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                prefs.privacy ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:text-primary',
              )}
            >
              {prefs.privacy ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Paramétrer le dashboard"
              title="Paramétrer le dashboard"
              className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
            >
              <GearIcon className="size-4" />
            </button>
          </>,
          topBarSlot,
        )}

      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}

      {prefs.showObjectives && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold tracking-[1.5px] text-ink-muted">
            VOS OBJECTIFS
          </h2>
          {principals.length === 0 ? (
            <ObjectiveSlotsEmpty />
          ) : (
            <>
              {/* desktop : une colonne par emplacement */}
              <div className="hidden gap-4 lg:grid lg:grid-cols-3">
                {principals.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    week={weekIndex.get(`${objective.id}|${currentWeek!.isoWeek}`)}
                    activeDays={activeDays}
                    milestones={milestonesByObjective.get(objective.id) ?? []}
                    daysOfWeek={weekDays}
                    today={today!}
                    privacy={prefs.privacy}
                    showMilestones={prefs.showMilestones}
                    lit={isLit(objective)}
                    popping={poppingObjectiveId === objective.id}
                  />
                ))}
              </div>
              {/* mobile : les cartes compactes s'empilent, une par ligne. À trois
                  par ligne sur 390 px, chacune tombait sous 110 px et le titre se
                  réduisait à « M… ». */}
              <div className="flex flex-col gap-2.5 lg:hidden">
                {principals.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    week={weekIndex.get(`${objective.id}|${currentWeek!.isoWeek}`)}
                    activeDays={activeDays}
                    milestones={milestonesByObjective.get(objective.id) ?? []}
                    daysOfWeek={weekDays}
                    today={today!}
                    compact
                    privacy={prefs.privacy}
                    showMilestones={prefs.showMilestones}
                    lit={isLit(objective)}
                    popping={poppingObjectiveId === objective.id}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {prefs.showFocus && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <FocusTodayCard
            tasks={visibleToday}
            objectives={objectiveById}
            lists={listById}
            onToggle={handleToggle}
            hasObjectives={(objectivesQuery.data?.length ?? 0) > 0}
            donePhaseFor={donePhaseFor}
            reducedMotion={reducedMotion}
          />
          <OverdueCard
            tasks={visibleOverdue}
            objectives={objectiveById}
            lists={listById}
            onToggle={handleToggle}
            donePhaseFor={donePhaseFor}
            reducedMotion={reducedMotion}
          />
        </div>
      )}

      {prefs.showStats && principals.length > 0 && (
        <QuarterActivity
          objectives={principals}
          weeks={quarterWeeks}
          weekIndex={weekIndex}
          activeDays={activeDays}
          today={today!}
          quarter={quarter!}
        />
      )}

      <DashboardSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
