import { useMemo, useState } from 'react'
import { ErrorState } from '../../components/ui/ErrorState'
import { useAppToday } from '../../hooks/useAppToday'
import { useLists } from '../../hooks/useLists'
import { selectPrincipals, selectSecondaries, useObjectives } from '../../hooks/useObjectives'
import { usePendingBilan } from '../../hooks/usePendingBilan'
import { type Task } from '../../hooks/useTasks'
import { useToggleTask } from '../../hooks/useToggleTask'
import { useUpdateTask } from '../../hooks/useTaskMutations'
import { useDoneSequence } from '../../hooks/useDoneSequence'
import { dataErrorMessage } from '../../lib/errorMessage'
import { objectivesForPeriod, objectivesForQuarter } from '../../lib/reviewPeriod'
import { year as yearOf } from '../../lib/appDate'
import { DashboardLayoutProvider } from './DashboardLayoutProvider'
import type { WidgetId } from './dashboardLayout'
import { useDashboardLayout } from './useDashboardLayout'
import { DashboardContext, type DashboardCtx } from './dashboardContext'
import { DashboardGrid } from './components/DashboardGrid'
import { DashboardToolbar } from './components/DashboardToolbar'
import { WidgetPickerModal } from './components/WidgetPickerModal'
import { BilanCard } from './components/BilanCard'
import { ObjectivesSection } from './components/ObjectivesSection'
import { usePrivacy } from '../../hooks/usePrivacy'
import { useQueriesState, type QueryLike } from '../../hooks/useQueriesState'
import { PageLoading, PageError } from '../../components/layout/PageState'
import { Button } from '../../components/ui/Button'

// Le provider de disposition reste interne à la feature : le dashboard est le
// seul écran qui la consomme, App.tsx n'a pas à en connaître l'existence.
export function HomePage() {
  return (
    <DashboardLayoutProvider>
      <Dashboard />
    </DashboardLayoutProvider>
  )
}

/**
 * L'accueil : la bande d'objectifs, le bilan s'il attend, puis la grille de widgets.
 *
 * La page ne charge plus que ce qu'elle rend elle-même. Chaque widget porte ses
 * propres queries — il peut ne pas être monté du tout, et une page qui chargerait
 * pour lui travaillerait dans le vide. Elle garde en revanche les INTERACTIONS
 * (`DashboardContext`) : cocher une tâche dans un widget allume la carte
 * d'objectif dans un autre, et cette liaison a besoin d'une seule séquence.
 *
 * Deux blocs restent ÉPINGLÉS, hors grille : la bande d'objectifs, qui est
 * l'identité de l'écran, et le bilan de trimestre, qui se périme et ne se rattrape
 * pas. Le rituel, lui, est devenu un widget — et la page le tait tant qu'un bilan
 * attend, pour ne jamais afficher deux rendez-vous à la fois.
 */
function Dashboard() {
  const { layout, addWidget } = useDashboardLayout()
  // Le masquage vient de la coquille, pas de la disposition : il vaut aussi sur
  // Tâches, Objectifs et Année.
  const { privacy } = usePrivacy()
  const [editing, setEditing] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Tout le dashboard s'ancre sur la date du serveur : rien ne dépend de
  // l'horloge du navigateur.
  const todayQuery = useAppToday()
  const today = todayQuery.data

  const objectivesQuery = useObjectives(today ? yearOf(today) : undefined)
  const listsQuery = useLists()

  const bilan = usePendingBilan()

  const toggleTask = useToggleTask()
  const updateTask = useUpdateTask()

  const yearPrincipals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const secondaries = useMemo(
    () => selectSecondaries(objectivesQuery.data),
    [objectivesQuery.data],
  )
  const {
    poppingObjectiveId,
    startDoneSequence,
    clearDone,
    donePhaseFor,
    isVisible,
    reducedMotion,
  } = useDoneSequence()

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
    updateTask.mutate({ id: task.id, edits: { is_important: !task.is_important } })
  }

  const ctx: DashboardCtx | null = today
    ? {
        today,
        privacy,
        reducedMotion,
        onToggleTask: handleToggle,
        onToggleImportant: handleToggleImportant,
        donePhaseFor,
        poppingObjectiveId,
        isVisible,
      }
    : null

  // --- Le bilan --------------------------------------------------------------
  // Il prend le pas sur le rituel quand les deux attendent : il est plus rare, il
  // se périme (un emplacement se libère ce soir-là), et le rituel reste faisable
  // après. Deux rendez-vous côte à côte transformeraient l'accueil en arriéré — la
  // dette que la refonte enlève. D'où le widget Rituel tu tant qu'un bilan attend.
  //
  // Le compte se fait avec les MÊMES fonctions que `BilanPage` : un trimestre
  // passe par `objectivesForQuarter`, l'année par `objectivesForPeriod`. Compter
  // autrement annoncerait « 3 objectifs » sur un bilan qui n'en montrerait que deux.
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
  // Mémoïsé : la grille s'en sert comme dépendance, un tableau neuf à chaque rendu
  // relancerait tout son calcul d'ordre.
  const hiddenWidgets = useMemo<WidgetId[]>(() => (showBilan ? ['ritual'] : []), [showBilan])

  // Les queries de l'écran — celles que la PAGE rend. Les widgets portent les
  // leurs et affichent leur propre erreur, sans vider l'accueil pour autant.
  const queries: QueryLike[] = [todayQuery, objectivesQuery, listsQuery]
  const { firstError, retrying, onRetry } = useQueriesState(queries, bilan.error)

  // Seul `today` bloque le rendu : tout le reste en dérive. Les autres queries
  // se dégradent proprement — les ajouter ici ferait clignoter l'écran à chaque
  // invalidation post-complétion.
  if (todayQuery.isPending) {
    return <PageLoading />
  }

  if (todayQuery.isError || !ctx) {
    return (
      <PageError
        title="Impossible de charger le dashboard"
        error={todayQuery.error ?? new Error('date du serveur indisponible')}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  return (
    <DashboardContext value={ctx}>
      <div className="flex flex-col gap-4.5">
        <h1 className="sr-only">Dashboard</h1>

        <DashboardToolbar editing={editing} onToggleEditing={() => setEditing((v) => !v)} />

        {firstError && (
          <ErrorState
            description={dataErrorMessage(firstError)}
            onRetry={onRetry}
            retrying={retrying}
          />
        )}

        {/* Épinglée, et première : c'est l'identité de l'écran. On ne la déplace
            pas, on ne la rétrécit pas, on ne la retire pas. */}
        <ObjectivesSection />

        {/* Le bilan reste épinglé lui aussi : il se périme, on ne le rattrape pas.
            Le rituel, devenu widget, se tait pendant ce temps-là. */}
        {showBilan && bilan.pending && (
          <BilanCard
            year={bilan.pending.year}
            period={bilan.pending.period}
            objectiveCount={bilanObjectives.length}
          />
        )}

        {editing && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface px-5 py-4 shadow-card">
            <p className="min-w-50 flex-1 text-body text-ink-2">
              Glissez les widgets pour les ranger, réglez leur largeur, retirez ce qui ne
              vous sert pas.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
              Ajouter un widget
            </Button>
            <Button size="sm" onClick={() => setEditing(false)}>
              Terminé
            </Button>
          </div>
        )}

        <DashboardGrid editing={editing} hidden={hiddenWidgets} />

        <WidgetPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          layout={layout}
          onAdd={addWidget}
        />
      </div>
    </DashboardContext>
  )
}
