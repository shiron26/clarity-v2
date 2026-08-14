import { useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { RepeatIcon } from '../../../components/icons/RepeatIcon'
import { ListPill } from '../../../components/tasks/ListPill'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import type { DonePhase } from '../../../components/tasks/taskDone'
import { Calendar } from '../../../components/ui/Calendar'
import { Menu } from '../../../components/ui/Menu'
import { Popover } from '../../../components/ui/Popover'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'
import { addDays, formatDayMonth, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { objectiveSkin } from '../../../lib/objectivePalette'
import { DueQuickLinks } from './DueQuickLinks'

type TaskListRowProps = {
  task: Task
  /** Slot de l'objectif lié : donne sa couleur à la ligne et à la case. */
  objectiveSlot: number | null | undefined
  list: List | undefined
  /** Toutes les listes disponibles, pour le menu de la pastille. */
  lists: List[]
  /** Date du serveur — l'unique référence pour « Aujourd'hui » et « Demain ». */
  today: IsoDate
  /** La poignée n'existe qu'en tri manuel. */
  canDrag: boolean
  /** Ligne saisie (souris ou clavier) : elle s'efface le temps du déplacement. */
  dragging?: boolean
  /** Mode déplacement au clavier actif sur cette ligne. */
  grabbed?: boolean
  donePhase?: DonePhase
  reducedMotion?: boolean
  onToggle: (task: Task) => void
  onRename: (task: Task, title: string) => void
  onToggleImportant: (task: Task) => void
  onPickList: (task: Task, listId: string | null) => void
  onPickDue: (task: Task, dueDate: IsoDate | null) => void
  onOpen: (task: Task) => void
  onDelete: (task: Task) => void
  onGripPointerDown?: (event: PointerEvent<HTMLButtonElement>, task: Task) => void
  onGripKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, task: Task) => void
}

// Les trois actions rapides de fin de ligne : même carré fantôme de 30px, seule
// la couleur de survol les distingue (maquette v2).
const ACTION = cn(
  'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-muted',
  'transition-colors duration-150 hover:bg-primary-soft hover:text-primary',
  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)

export function TaskListRow({
  task,
  objectiveSlot,
  list,
  lists,
  today,
  canDrag,
  dragging = false,
  grabbed = false,
  donePhase,
  reducedMotion = false,
  onToggle,
  onRename,
  onToggleImportant,
  onPickList,
  onPickDue,
  onOpen,
  onDelete,
  onGripPointerDown,
  onGripKeyDown,
}: TaskListRowProps) {
  // Le survol est local à la ligne : le remonter dans l'écran ferait re-rendre
  // toute la liste à chaque passage de souris. `focusWithin` fait entrer le
  // clavier par la même porte — la maquette, elle, ne connaît que la souris.
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  const [openMenu, setOpenMenu] = useState<'list' | 'due' | null>(null)

  const listTriggerRef = useRef<HTMLButtonElement>(null)
  const dueTriggerRef = useRef<HTMLButtonElement>(null)

  const done = task.completed_at !== null
  const accent = objectiveSlot != null ? objectiveSkin(objectiveSlot).core : null
  const linked = accent !== null && !done
  const bursting = donePhase !== undefined && !reducedMotion

  function startEditing() {
    setDraft(task.title)
    setEditing(true)
  }

  function commitEditing() {
    setEditing(false)
    const next = draft.trim()
    // Un titre vide n'efface pas la tâche : on annule simplement.
    if (next && next !== task.title) onRename(task, next)
  }

  function onRowBlur(event: FocusEvent<HTMLLIElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    setRevealed(false)
  }

  const dueLabel = task.due_date
    ? task.due_date === today
      ? 'Aujourd’hui'
      : task.due_date === addDays(today, 1)
        ? 'Demain'
        : formatDayMonth(task.due_date)
    : 'Planifier'

  // Échéance, ouverture et suppression sont désormais permanentes (maquette v2) :
  // il ne reste au survol que ce qui n'a rien à dire au repos — l'invite « + Liste »
  // et le drapeau d'une tâche non importante. Les deux se masquent par `invisible`
  // et non par un rendu conditionnel : la largeur de la ligne ne bouge pas.
  const hideAddList = !revealed && openMenu !== 'list'
  const hideFlag = !task.is_important && !revealed

  return (
    <li
      data-task-row={task.id}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={onRowBlur}
      className={cn(
        'flex items-center gap-[13px] py-[13px] pr-2.5',
        'transition-colors duration-[250ms] hover:bg-[#fafaf8]',
        linked ? 'border-l-[3px] pl-3.5' : 'pl-[17px]',
        dragging && 'opacity-35',
        grabbed && 'bg-primary-soft/60',
        !reducedMotion && donePhase === 1 && 'animate-row-flash',
        !reducedMotion && donePhase === 2 && 'animate-row-collapse overflow-hidden',
      )}
      style={
        linked && accent
          ? {
              borderLeftColor: accent,
              backgroundImage: `linear-gradient(90deg,${accent}0d,transparent 60%)`,
            }
          : undefined
      }
    >
      {canDrag && (
        <button
          type="button"
          aria-label={`Déplacer ${task.title}`}
          aria-pressed={grabbed}
          onPointerDown={(event) => onGripPointerDown?.(event, task)}
          onKeyDown={(event) => onGripKeyDown?.(event, task)}
          className={cn(
            'shrink-0 cursor-grab touch-none px-0.5 text-[12px] leading-none text-border-idle',
            'transition-colors duration-150 hover:text-ink-muted',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            grabbed && 'cursor-grabbing text-primary',
          )}
        >
          <span aria-hidden>⠿</span>
        </button>
      )}

      <TaskCheckbox
        done={done}
        title={task.title}
        accent={accent}
        bursting={bursting}
        onToggle={() => onToggle(task)}
      />

      {/* La récurrence a quitté le bloc d'actions pour la gauche du titre : c'est
          une propriété de la tâche, pas une action (maquette v2). */}
      {task.recurrence != null && (
        <span title="Tâche récurrente" className="flex shrink-0 items-center text-[#b8b8b0]">
          <RepeatIcon className="size-3" />
          <span className="sr-only">Tâche récurrente</span>
        </span>
      )}

      {editing ? (
        <input
          value={draft}
          autoFocus
          aria-label="Titre de la tâche"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitEditing()
            if (event.key === 'Escape') setEditing(false)
          }}
          className="min-w-0 flex-1 rounded-sm border-[1.5px] border-[#a9beff] bg-canvas px-2.5 py-1.5 text-[13px] text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          onDoubleClick={startEditing}
          // Le double-clic est un geste souris : Entrée et F2 ouvrent la même
          // édition au clavier.
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault()
              startEditing()
            }
          }}
          title="Double-clic pour modifier"
          className={cn(
            'min-w-0 flex-1 cursor-text truncate rounded-xs text-left text-[13px] transition-colors duration-300',
            'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
            done ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {task.title}
        </button>
      )}

      <button
        type="button"
        aria-pressed={task.is_important}
        aria-label="Marquer comme important"
        onClick={() => onToggleImportant(task)}
        className={cn(
          'shrink-0 cursor-pointer text-[19px] leading-none transition-[color,transform] duration-150',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
          task.is_important ? 'text-danger' : 'text-[#b8b8b0] hover:text-ink-muted',
          hideFlag && 'invisible',
        )}
        style={
          task.is_important ? { filter: 'drop-shadow(0 1px 3px rgb(214 67 31 / 0.4))' } : undefined
        }
      >
        <span aria-hidden>⚑</span>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ListPill
          ref={listTriggerRef}
          name={list?.name ?? ''}
          color={list?.color}
          dashed={!list}
          className={cn(!list && hideAddList && 'invisible')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'list'}
          onClick={() => setOpenMenu((current) => (current === 'list' ? null : 'list'))}
        >
          <Menu
            open={openMenu === 'list'}
            onClose={() => setOpenMenu(null)}
            label="Choisir une liste"
            triggerRef={listTriggerRef}
            className="min-w-[130px]"
            items={[
              ...lists.map((candidate) => ({
                id: candidate.id,
                label: candidate.name,
                selected: task.list_id === candidate.id,
                leading: (
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: candidate.color ?? '#9a9aa6' }}
                  />
                ),
                onSelect: () => onPickList(task, candidate.id),
              })),
              {
                id: 'none',
                label: 'Aucune',
                selected: task.list_id === null,
                leading: (
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-idle" />
                ),
                onSelect: () => onPickList(task, null),
              },
            ]}
          />
        </ListPill>

        <span className="relative flex">
          <button
            ref={dueTriggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={openMenu === 'due'}
            aria-label={`Échéance : ${dueLabel}`}
            title={`Échéance : ${dueLabel}`}
            onClick={() => setOpenMenu((current) => (current === 'due' ? null : 'due'))}
            className={ACTION}
          >
            <CalendarIcon className="size-3.5" />
          </button>

          {/* La maquette v2 pose le calendrier directement sous la pastille : plus
              de menu de présélections, donc plus de « Autre date… » à aller chercher. */}
          <Popover
            open={openMenu === 'due'}
            onClose={() => setOpenMenu(null)}
            label="Choisir une échéance"
            placement="bottom"
            offset={36}
            triggerRef={dueTriggerRef}
            className="w-[266px] rounded-xl p-3.5 shadow-popover-strong"
          >
            <Calendar
              value={task.due_date}
              today={today}
              onChange={(next) => {
                onPickDue(task, next)
                setOpenMenu(null)
              }}
            />
            <DueQuickLinks
              value={task.due_date}
              today={today}
              variant="link"
              showTomorrow={false}
              onChange={(next) => {
                onPickDue(task, next)
                setOpenMenu(null)
              }}
            />
          </Popover>
        </span>

        <button
          type="button"
          aria-label={`Ouvrir ${task.title}`}
          title="Ouvrir la tâche"
          onClick={() => onOpen(task)}
          className={cn(ACTION, 'text-[13px]')}
        >
          <span aria-hidden>⤢</span>
        </button>
        <button
          type="button"
          aria-label={`Supprimer ${task.title}`}
          title={
            task.recurrence != null
              ? 'Supprimer — cette tâche est récurrente, la supprimer arrête la série'
              : 'Supprimer la tâche'
          }
          onClick={() => onDelete(task)}
          className={cn(ACTION, 'text-[13px] hover:bg-danger-bg hover:text-danger')}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
    </li>
  )
}
