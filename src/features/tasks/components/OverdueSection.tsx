import type { DonePhase } from '../../../components/tasks/taskDone'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { formatOverdueDelay, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { TaskListRow } from './TaskListRow'
import { TaskRowCompact } from './TaskRowCompact'

type OverdueSectionProps = {
  tasks: Task[]
  /** Ancre serveur : c'est elle qui date le retard, pas l'horloge du navigateur. */
  today: IsoDate
  objectiveSlotOf: (task: Task) => number | null | undefined
  /** Listes indexées par id, pour la pastille de chaque ligne. */
  listById: Map<string, List>
  /** Toutes les listes, pour le menu de la pastille en desktop. */
  lists: List[]
  onToggle: (task: Task) => void
  onToggleImportant: (task: Task) => void
  onPickList: (task: Task, listId: string | null) => void
  onPickDue: (task: Task, dueDate: IsoDate | null) => void
  onOpen: (task: Task) => void
  onDelete: (task: Task) => void
  /** Report en masse (SPEC §5) — tâches personnelles uniquement. */
  onPostponeAll: () => void
  postponing: boolean
  /** L'autre sortie : retirer la date, la tâche rejoint « Sans date ». */
  onUndateAll: () => void
  undating: boolean
  donePhaseFor: (taskId: string) => DonePhase | undefined
  reducedMotion: boolean
  className?: string
}

/**
 * Les deux actions groupées partagent leur forme : une pastille arrondie, **aux
 * deux largeurs**. Elles étaient du texte nu en mobile, pour gagner de la place :
 * deux mots gris alignés à droite d'un titre, que rien ne désignait comme
 * cliquables. Un fond et un rayon coûtent quelques pixels et rendent le bouton
 * évident ; c'est le libellé qui se raccourcit, pas la forme. Plus haut au doigt
 * qu'au curseur, pour la même raison.
 */
const BULK_ACTION = cn(
  'cursor-pointer rounded-2xl px-3 py-1.5 text-[11.5px] font-medium whitespace-nowrap',
  'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
  'disabled:cursor-default disabled:opacity-60',
  'lg:py-[5px] lg:text-[11px]',
)

/**
 * Le retard a sa section, pas ses propres lignes : ce sont celles du reste de
 * l'écran, aux mêmes breakpoints, pour que les deux blocs se manipulent
 * pareil. Seule différence assumée — pas de poignée de glisser : l'ordre manuel
 * porte sur la liste entière, réordonner une sous-section ne veut rien dire.
 */
export function OverdueSection({
  tasks,
  today,
  objectiveSlotOf,
  listById,
  lists,
  onToggle,
  onToggleImportant,
  onPickList,
  onPickDue,
  onOpen,
  onDelete,
  onPostponeAll,
  postponing,
  onUndateAll,
  undating,
  donePhaseFor,
  reducedMotion,
  className,
}: OverdueSectionProps) {
  if (tasks.length === 0) return null

  const delayOf = (task: Task) =>
    task.due_date ? `En retard · ${formatOverdueDelay(task.due_date, today)}` : undefined
  const listOf = (task: Task) => (task.list_id ? listById.get(task.list_id) : undefined)

  return (
    <section className={className}>
      {/* Le titre et le bouton forment une barre au-dessus de la liste : à
          2 px, elle se collait à la première tâche et se lisait comme sa
          première ligne. */}
      <div className="mb-3.5 flex items-center gap-3 lg:mb-2.5">
        <h2 className="text-[9.5px] font-semibold tracking-[1.3px] text-danger lg:text-[11px] lg:tracking-[1.2px]">
          EN RETARD ({tasks.length})
        </h2>
        {/* Deux sorties possibles, et la seconde n'est pas un repli : reporter
            à aujourd'hui suppose qu'on s'en occupe aujourd'hui, alors qu'une
            pile de retards contient surtout des choses qu'on fera « un jour ».
            La retirer du calendrier est souvent la réponse honnête — d'où deux
            boutons de même taille, celui du report gardant seul le rouge. */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPostponeAll}
            disabled={postponing || undating}
            title="Reporte vos tâches en retard à aujourd’hui. Les tâches partagées ne bougent pas."
            className={cn(BULK_ACTION, 'bg-danger-bg text-danger hover:bg-[#fbdcc6]')}
          >
            <span className="lg:hidden">Reporter</span>
            <span className="hidden lg:inline">Tout reporter à aujourd’hui</span>
          </button>
          <button
            type="button"
            onClick={onUndateAll}
            disabled={postponing || undating}
            title="Retire la date de vos tâches en retard : elles passent dans « Sans date ». Les tâches partagées ne bougent pas."
            className={cn(BULK_ACTION, 'bg-field text-ink-3 hover:bg-border hover:text-ink')}
          >
            <span className="lg:hidden">Sans date</span>
            <span className="hidden lg:inline">Tout mettre sans date</span>
          </button>
        </div>
      </div>

      <ul className="hidden flex-col lg:flex">
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            objectiveSlot={objectiveSlotOf(task)}
            list={listOf(task)}
            lists={lists}
            today={today}
            canDrag={false}
            donePhase={donePhaseFor(task.id)}
            reducedMotion={reducedMotion}
            overdueLabel={delayOf(task)}
            onToggle={onToggle}
            onToggleImportant={onToggleImportant}
            onPickList={onPickList}
            onPickDue={onPickDue}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </ul>

      <ul className="flex flex-col lg:hidden">
        {tasks.map((task) => (
          <TaskRowCompact
            key={task.id}
            task={task}
            objectiveSlot={objectiveSlotOf(task)}
            list={listOf(task)}
            donePhase={donePhaseFor(task.id)}
            reducedMotion={reducedMotion}
            overdueLabel={delayOf(task)}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  )
}
