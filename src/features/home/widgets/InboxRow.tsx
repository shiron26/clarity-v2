import { useRef, useState } from 'react'
import { TaskCheckbox } from '../../../components/tasks/TaskCheckbox'
import { ListPill } from '../../../components/tasks/ListPill'
import { DueQuickLinks } from '../../../components/tasks/DueQuickLinks'
import { Menu } from '../../../components/ui/Menu'
import { Popover } from '../../../components/ui/Popover'
import { Calendar } from '../../../components/ui/Calendar'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { DEFAULT_LIST_COLOR } from '../../../lib/listPalette'
import { cn } from '../../../lib/cn'
import type { IsoDate } from '../../../lib/appDate'
import type { List } from '../../../hooks/useLists'
import type { Task } from '../../../hooks/useTasks'

const ACTION = cn(
  'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-muted',
  'transition-colors duration-150 hover:bg-primary-soft hover:text-primary',
  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)

/**
 * Une ligne du tas, avec de quoi la ranger sur place.
 *
 * C'est la raison d'être du widget : « À trier » ne sert à rien s'il faut ouvrir
 * l'écran Tâches pour donner une liste ou une date. Les deux gestes sont donc là,
 * et ils font sortir la ligne du tas — le filtre du widget est précisément
 * « sans date et sans liste ».
 *
 * Mêmes commandes que la ligne de l'écran Tâches (pastille de liste à menu,
 * calendrier en surcouche), en plus court : ni drapeau, ni récurrence, ni
 * suppression. Ce qui est ici n'est pas encore assez décidé pour mériter tout ça.
 */
type InboxRowProps = {
  task: Task
  lists: List[]
  today: IsoDate
  onToggle: (task: Task) => void
  onPickList: (task: Task, listId: string | null) => void
  onPickDue: (task: Task, dueDate: IsoDate | null) => void
}

export function InboxRow({
  task,
  lists,
  today,
  onToggle,
  onPickList,
  onPickDue,
}: InboxRowProps) {
  const [open, setOpen] = useState<'list' | 'due' | null>(null)
  const listTriggerRef = useRef<HTMLButtonElement>(null)
  const dueTriggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="group flex items-center gap-2.5 py-1.5">
      <TaskCheckbox
        done={task.completed_at !== null}
        title={task.title}
        compact
        onToggle={() => onToggle(task)}
      />

      <span className="min-w-0 flex-1 truncate text-body text-ink">{task.title}</span>

      {/* Révélées au survol là où il y en a un, visibles ailleurs : au doigt, une
          commande qui n'apparaît qu'au survol n'existe pas. */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-1 transition-opacity duration-150',
          'opacity-0 max-lg:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100',
          open !== null && 'opacity-100',
        )}
      >
        <ListPill
          ref={listTriggerRef}
          name=""
          dashed
          size="sm"
          aria-haspopup="menu"
          aria-expanded={open === 'list'}
          onClick={() => setOpen((current) => (current === 'list' ? null : 'list'))}
        >
          <Menu
            open={open === 'list'}
            onClose={() => setOpen(null)}
            label="Ranger dans une liste"
            triggerRef={listTriggerRef}
            className="min-w-[130px]"
            items={lists.map((candidate) => ({
              id: candidate.id,
              label: candidate.name,
              leading: (
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: candidate.color ?? DEFAULT_LIST_COLOR }}
                />
              ),
              onSelect: () => onPickList(task, candidate.id),
            }))}
          />
        </ListPill>

        <span className="relative flex">
          <button
            ref={dueTriggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open === 'due'}
            aria-label={`Donner une échéance à « ${task.title} »`}
            title="Donner une échéance"
            onClick={() => setOpen((current) => (current === 'due' ? null : 'due'))}
            className={ACTION}
          >
            <CalendarIcon className="size-3.5" />
          </button>

          <Popover
            open={open === 'due'}
            onClose={() => setOpen(null)}
            label="Choisir une échéance"
            placement="bottom"
            offset={34}
            triggerRef={dueTriggerRef}
            className="w-[266px] rounded-xl p-3.5 shadow-popover-strong"
          >
            <Calendar
              value={task.due_date}
              today={today}
              onChange={(next) => {
                onPickDue(task, next)
                setOpen(null)
              }}
            />
            <DueQuickLinks
              value={task.due_date}
              today={today}
              variant="link"
              onChange={(next) => {
                onPickDue(task, next)
                setOpen(null)
              }}
            />
          </Popover>
        </span>
      </div>
    </div>
  )
}
