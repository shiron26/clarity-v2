import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { RepeatIcon } from '../../../components/icons/RepeatIcon'
import { Alert } from '../../../components/ui/Alert'
import { Calendar } from '../../../components/ui/Calendar'
import { Modal } from '../../../components/ui/Modal'
import { Popover } from '../../../components/ui/Popover'
import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import { useDeleteTask, useUpdateTask } from '../../../hooks/useTaskMutations'
import type { Task } from '../../../hooks/useTasks'
import type { IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import {
  buildRecurrence,
  intervalOf,
  parseRecurrence,
  presetOf,
  recurrenceSummary,
  type RecurrencePreset,
} from '../../../lib/recurrence'
import { DueQuickLinks } from './DueQuickLinks'
import { ListPills } from './ListPills'
import { ObjectivePills } from './ObjectivePills'
import { RecurrenceEditor } from './RecurrenceEditor'
import {
  DISCLOSURE_ROW,
  SHEET_LABEL,
  TITLE_INPUT,
  dueLabelOf,
  importantButtonClass,
} from './taskSheet'
import { ToolbarToggle } from './ToolbarToggle'

type TaskEditModalProps = {
  /** `null` = fermée. */
  task: Task | null
  onClose: () => void
  principals: Objective[]
  lists: List[]
  /** Date du serveur — ancre du calendrier et des raccourcis d'échéance. */
  today: IsoDate
}

const LABEL = SHEET_LABEL

/**
 * Comme dans la maquette, chaque champ s'écrit au moment où on le change :
 * « Terminé » ne fait que fermer. Titre et description sont les seuls à attendre
 * le `blur`, pour ne pas partir en rafale de requêtes à chaque frappe.
 */
export function TaskEditModal({ task, onClose, principals, lists, today }: TaskEditModalProps) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const formId = useId()
  const dueTriggerRef = useRef<HTMLButtonElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)

  const rule = parseRecurrence(task?.recurrence)
  const preset = presetOf(rule)
  const interval = intervalOf(rule)
  const weekdays = rule?.weekdays ?? []

  useEffect(() => {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setDescriptionOpen((task?.description ?? '').length > 0)
    setConfirmingDelete(false)
    setDueOpen(false)
    setRecurrenceOpen(false)
  }, [task])

  if (!task) return null

  function edit(edits: Parameters<typeof updateTask.mutate>[0]['edits']) {
    updateTask.mutate({ id: task!.id, edits })
  }

  function commitTitle() {
    const next = title.trim()
    if (next && next !== task!.title) edit({ title: next })
  }

  function commitDescription() {
    const next = description.trim() || null
    if (next !== (task!.description ?? null)) edit({ description: next })
  }

  // Entrée = « Terminé ». Tous les autres champs se sont déjà écrits au changement ;
  // titre et description attendent, on les commit avant de fermer (le `onBlur` ferait
  // le même appel, mais rien ne garantit qu'il parte avant la fermeture — et ces
  // commits comme `useUpdateTask` sont idempotents, un doublon serait sans effet).
  function saveAndClose() {
    commitTitle()
    commitDescription()
    onClose()
  }

  /**
   * Comme dans la modale de création : un `<button>` focalisé consomme Entrée pour
   * s'activer, donc la soumission implicite ne suffit pas dès qu'on a cliqué une
   * pastille. Espace continue d'activer le bouton focalisé.
   *
   * Effet de bord voulu : Entrée pendant la confirmation de suppression ferme la
   * modale au lieu de supprimer — la suppression est définitive, elle mérite un
   * geste explicite.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    // La description est multi-ligne : Entrée y écrit un saut de ligne.
    if (event.target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    saveAndClose()
  }

  function changeRecurrence(next: {
    preset?: RecurrencePreset
    interval?: number
    weekdays?: number[]
  }) {
    edit({
      recurrence: buildRecurrence(
        next.preset ?? preset,
        next.interval ?? interval,
        next.weekdays ?? weekdays,
      ),
    })
  }

  const dueLabel = dueLabelOf(task.due_date, today)

  return (
    <Modal
      open
      onClose={onClose}
      title="Modifier la tâche"
      variant="sheet"
      className="sm:w-[760px]"
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          saveAndClose()
        }}
        onKeyDown={handleKeyDown}
        className="flex flex-col"
      >
        <div className="flex items-stretch gap-2">
          <input
            value={title}
            data-autofocus
            placeholder="Décrire la tâche…"
            aria-label="Titre de la tâche"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            className={TITLE_INPUT}
          />
          <button
            type="button"
            aria-pressed={task.is_important}
            aria-label="Important"
            title="Important"
            onClick={() => edit({ is_important: !task.is_important })}
            className={importantButtonClass(task.is_important)}
          >
            <span aria-hidden>⚑</span>
          </button>
        </div>

        {descriptionOpen ? (
          <textarea
            value={description}
            rows={2}
            placeholder="Description…"
            aria-label="Description de la tâche"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={commitDescription}
            className="mt-2 w-full resize-none rounded-panel border-[1.5px] border-border bg-canvas px-3.5 py-3 text-[12.5px] text-ink outline-none placeholder:text-placeholder focus:border-primary focus:bg-surface sm:rounded-lg sm:py-2.5 sm:text-[12px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setDescriptionOpen(true)}
            className="w-fit cursor-pointer rounded-xs px-0.5 pt-2 text-[11px] text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
          >
            + Ajouter une description
          </button>
        )}

        <p className={cn(LABEL, 'mt-4.5 mb-2')}>OBJECTIF</p>
        <ObjectivePills
          objectives={principals}
          value={task.objective_id}
          onChange={(objectiveId) => edit({ objective_id: objectiveId })}
        />

        {lists.length > 0 && (
          <>
            <p className={cn(LABEL, 'mt-3.5 mb-2')}>LISTE</p>
            <ListPills
              lists={lists}
              value={task.list_id}
              onChange={(listId) => edit({ list_id: listId })}
            />
          </>
        )}

        {/* Mobile : lignes dépliables. Desktop : derrière les déclencheurs de la
            barre d'outils du pied, comme la maquette. */}
        <div className="sm:hidden">
          <p className={cn(LABEL, 'mt-4.5 mb-2')}>ÉCHÉANCE</p>
          <button
            type="button"
            aria-expanded={dueOpen}
            onClick={() => setDueOpen((v) => !v)}
            className={DISCLOSURE_ROW}
          >
            <CalendarIcon className="size-4 shrink-0 text-ink-3" />
            <span className="flex-1 text-left text-ui text-ink">{dueLabel}</span>
            <span aria-hidden className="text-body text-ink-muted">
              {dueOpen ? '▾' : '▸'}
            </span>
          </button>
          {dueOpen && (
            <div className="animate-fade-in mt-2.5 rounded-panel border-[1.5px] border-border bg-surface p-3.5">
              <Calendar
                value={task.due_date}
                today={today}
                size="lg"
                onChange={(next) => edit({ due_date: next })}
              />
              <DueQuickLinks
                value={task.due_date}
                today={today}
                variant="chip"
                onChange={(next) => edit({ due_date: next })}
              />
            </div>
          )}

          <p className={cn(LABEL, 'mt-4.5 mb-2')}>RÉCURRENCE</p>
          <button
            type="button"
            aria-expanded={recurrenceOpen}
            onClick={() => setRecurrenceOpen((v) => !v)}
            className={DISCLOSURE_ROW}
          >
            <RepeatIcon className="size-4 shrink-0 text-ink-3" />
            <span className="flex-1 text-left text-ui text-ink">{recurrenceSummary(rule)}</span>
            <span aria-hidden className="text-body text-ink-muted">
              {recurrenceOpen ? '▾' : '▸'}
            </span>
          </button>
          {recurrenceOpen && (
            <div className="animate-fade-in mt-2.5">
              <RecurrenceEditor
                variant="list"
                preset={preset}
                interval={interval}
                weekdays={weekdays}
                onPresetChange={(next) => changeRecurrence({ preset: next, interval: 1 })}
                onIntervalChange={(next) => changeRecurrence({ interval: next })}
                onWeekdaysChange={(next) => changeRecurrence({ weekdays: next })}
              />
            </div>
          )}
        </div>

        {(updateTask.error || deleteTask.error) && (
          <Alert className="mt-3">
            {dataErrorMessage(updateTask.error ?? deleteTask.error)}
          </Alert>
        )}

        <div className="mt-4.5 flex flex-col gap-2.5 border-t border-surface-subtle pt-3.5 sm:flex-row sm:items-center sm:gap-2">
          <div className="hidden shrink-0 items-center gap-[3px] rounded-lg bg-field p-1 sm:flex">
            <span className="relative flex">
              <ToolbarToggle
                ref={dueTriggerRef}
                active
                aria-haspopup="dialog"
                aria-expanded={dueOpen}
                onClick={() => setDueOpen((v) => !v)}
              >
                {dueLabel}
              </ToolbarToggle>

              {/* Le pied est en bas de modale : le calendrier s'ouvre vers le haut. */}
              <Popover
                open={dueOpen}
                onClose={() => setDueOpen(false)}
                label="Choisir une échéance"
                placement="top"
                align="left"
                triggerRef={dueTriggerRef}
                className="z-40 w-[228px] p-[11px]"
              >
                <Calendar
                  value={task.due_date}
                  today={today}
                  onChange={(next) => edit({ due_date: next })}
                />
                <DueQuickLinks
                  value={task.due_date}
                  today={today}
                  variant="link"
                  onChange={(next) => edit({ due_date: next })}
                />
              </Popover>
            </span>
            <ToolbarToggle
              active={task.is_important}
              tone="danger"
              aria-pressed={task.is_important}
              onClick={() => edit({ is_important: !task.is_important })}
            >
              <span aria-hidden>⚑</span> Important
            </ToolbarToggle>
            <ToolbarToggle
              active={preset !== 'none'}
              aria-expanded={recurrenceOpen}
              onClick={() => setRecurrenceOpen((v) => !v)}
            >
              <span aria-hidden>↻</span> {recurrenceSummary(rule)}
            </ToolbarToggle>
          </div>

          <div className="flex flex-col gap-2.5 sm:ml-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true)
                  return
                }
                deleteTask.mutate(task.id, { onSuccess: onClose })
              }}
              className={cn(
                'order-2 flex min-h-12 flex-1 shrink-0 cursor-pointer items-center justify-center rounded-panel px-4.5 text-ui font-medium',
                'sm:order-none sm:min-h-0 sm:flex-none sm:rounded-md sm:px-3.5 sm:py-2.5 sm:text-label',
                'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                confirmingDelete
                  ? 'bg-danger-bg text-danger'
                  : 'text-ink-muted hover:bg-danger-bg hover:text-danger',
              )}
            >
              {confirmingDelete ? 'Confirmer la suppression' : 'Supprimer'}
            </button>

            {/* La maquette supprime d'un clic ; la série récurrente s'arrête sans
                corbeille, donc on garde la confirmation en deux temps. */}
            {confirmingDelete && (
              <p className="order-3 text-caption leading-snug text-ink-muted sm:order-none">
                Définitif, sans corbeille.
                {task.recurrence != null && ' Cette tâche est récurrente : la série s’arrête.'}
              </p>
            )}

            <button
              type="submit"
              form={formId}
              className={cn(
                'order-1 flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-panel bg-primary px-4.5 text-ui font-medium text-white',
                'sm:order-none sm:min-h-0 sm:flex-none sm:shrink-0 sm:rounded-md sm:py-2.5 sm:text-[12px]',
                'transition-[background-color,box-shadow,transform] duration-150',
                'hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover',
                'active:translate-y-px active:bg-primary-active',
                'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              )}
            >
              Terminé
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
