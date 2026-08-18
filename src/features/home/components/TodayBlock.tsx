import { Link } from 'react-router'
import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import type { Task } from '../../../hooks/useTasks'
import type { DonePhase } from '../../../components/tasks/TaskRow'
import { TaskRowList } from '../../../components/tasks/TaskRowList'

/**
 * « Aujourd'hui » — une **sous-section**, pas la tête de page.
 *
 * Le dashboard mène avec la semaine ; les 24 heures viennent après. Ce bloc a
 * donc le droit d'être vide, et son état vide ne porte ni bordure pointillée ni
 * grande icône bleue : ces signaux se lisent comme un manque à combler, alors
 * qu'un jour sans rien de dû est un jour où rien n'était attendu.
 */
type TodayBlockProps = {
  tasks: Task[]
  objectives: Map<string, Objective>
  lists: Map<string, List>
  onToggle: (task: Task) => void
  onToggleImportant: (task: Task) => void
  /** L'utilisateur a-t-il au moins un objectif ? Change la phrase de l'état vide. */
  hasObjectives: boolean
  /** Toutes les cadences de la semaine sont-elles déjà tenues ? */
  weekComplete: boolean
  /** Nombre de séances faites cette semaine, pour la phrase de l'état vide. */
  sessionsThisWeek: number
  donePhaseFor?: (taskId: string) => DonePhase | undefined
  reducedMotion?: boolean
}

export function TodayBlock({
  tasks,
  objectives,
  lists,
  onToggle,
  onToggleImportant,
  hasObjectives,
  weekComplete,
  sessionsThisWeek,
  donePhaseFor,
  reducedMotion,
}: TodayBlockProps) {
  return (
    <section className="min-w-0 rounded-2xl bg-surface p-5 shadow-card">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-card font-semibold">Aujourd’hui</h2>
        {tasks.length > 0 && (
          <Link
            to="/taches"
            className="text-label font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Tout voir →
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyToday
          hasObjectives={hasObjectives}
          weekComplete={weekComplete}
          sessionsThisWeek={sessionsThisWeek}
        />
      ) : (
        <TaskRowList
          tasks={tasks}
          objectives={objectives}
          lists={lists}
          onToggle={onToggle}
          onToggleImportant={onToggleImportant}
          donePhaseFor={donePhaseFor}
          reducedMotion={reducedMotion}
        />
      )}
    </section>
  )
}

/**
 * Une phrase calme et une porte de sortie facultative. Pas de rouge, pas
 * d'icône, pas de bordure : rien à combler.
 */
function EmptyToday({
  hasObjectives,
  weekComplete,
  sessionsThisWeek,
}: {
  hasObjectives: boolean
  weekComplete: boolean
  sessionsThisWeek: number
}) {
  if (!hasObjectives) {
    return (
      <div className="px-5 py-6.5 text-center">
        <p className="text-body font-medium text-ink-2">Rien à faire pour l’instant</p>
        <p className="mx-auto mt-1.5 max-w-75 text-[11px] leading-relaxed text-ink-muted">
          Posez un objectif d’abord. Les tâches viendront s’y relier — et vous pourrez les
          cocher sans jamais leur donner de date.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-6.5 text-center">
      <p className="text-body font-medium text-ink-2">Rien de prévu aujourd’hui.</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
        {weekComplete
          ? `Vos ${sessionsThisWeek} séances de la semaine sont faites. Il n’y a rien à rattraper.`
          : 'Rien n’était attendu aujourd’hui — un jour sans est un jour sans, pas un trou.'}
      </p>
      <Link
        to="/taches?vue=sans-date"
        className="mt-3.5 inline-block text-label font-medium text-primary transition-colors hover:text-primary-hover"
      >
        Piocher dans les tâches sans date →
      </Link>
    </div>
  )
}
