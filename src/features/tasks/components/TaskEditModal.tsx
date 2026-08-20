import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { RepeatIcon } from '../../../components/icons/RepeatIcon'
import { Alert } from '../../../components/ui/Alert'
import { Calendar } from '../../../components/ui/Calendar'
import { Modal } from '../../../components/ui/Modal'
import { Popover } from '../../../components/ui/Popover'
import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import {
  useDeleteTask,
  useSkipTaskOccurrence,
  useUpdateTask,
} from '../../../hooks/useTaskMutations'
import {
  TASK_DELETE_PERMANENT,
  TASK_SERIES_LABEL,
  TASK_SKIP_LABEL,
  taskRepeatIntro,
} from '../../../components/tasks/taskDeleteCopy'
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
import { DueQuickLinks } from '../../../components/tasks/DueQuickLinks'
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
import { IMPORTANT_TOOLTIP, RECURRENCE_TOOLTIP } from './taskToolbarCopy'
import { buttonClasses } from '../../../components/ui/buttonClasses'

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
// Les boutons de suppression du pied : pleine largeur au doigt, compacts au
// curseur. Une seule définition, qu'il y ait un bouton ou deux.
const DELETE_CHOICE = cn(
  'flex min-h-12 flex-1 shrink-0 cursor-pointer items-center justify-center rounded-panel px-4.5 text-ui font-medium',
  'sm:min-h-0 sm:flex-none sm:rounded-md sm:px-3.5 sm:py-2.5 sm:text-label',
  'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
)

export function TaskEditModal({ task, onClose, principals, lists, today }: TaskEditModalProps) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const skipOccurrence = useSkipTaskOccurrence()
  const formId = useId()
  const dueTriggerRef = useRef<HTMLButtonElement>(null)

  // Feuille montée avec `open` en dur et démontée par son hôte : sans passer par
  // `Modal`, « Terminé » la ferait disparaître d'un coup au lieu de la faire
  // redescendre.
  const closeRef = useRef<(() => void) | null>(null)

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
  // Le choix « cette fois / la série » n'a de sens que sur une occurrence
  // ouverte : sur une tâche cochée, la suivante est déjà née.
  const repeats = rule !== null && task?.completed_at == null

  // Sur l'IDENTITÉ de la tâche, pas sur l'objet : le cache en rend un nouveau à
  // chaque invalidation, et l'effet se rejouait alors — cinq `setState` par
  // aller-retour serveur, y compris pendant les 360 ms de la fermeture animée.
  // L'intention est « on a changé de tâche », pas « le cache a répondu ». Effet
  // de bord assumé : une modification venue d'ailleurs ne réécrit pas les champs
  // ouverts, ce qui est de toute façon préférable à écraser une saisie en cours.
  useEffect(() => {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setDescriptionOpen((task?.description ?? '').length > 0)
    setConfirmingDelete(false)
    setDueOpen(false)
    setRecurrenceOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

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
  //
  // **Une seule mutation pour les deux champs.** Les commiter séparément partait en
  // deux requêtes, donc deux mises à jour optimistes et deux invalidations : quatre
  // vagues de rendu de la liste pendant que la feuille redescend, et la sortie
  // saccadait. Rien à envoyer quand rien n'a changé.
  function saveAndClose() {
    const nextTitle = title.trim()
    const nextDescription = description.trim() || null
    const edits: Parameters<typeof updateTask.mutate>[0]['edits'] = {}
    if (nextTitle && nextTitle !== task!.title) edits.title = nextTitle
    if (nextDescription !== (task!.description ?? null)) edits.description = nextDescription
    if (Object.keys(edits).length > 0) edit(edits)
    ;(closeRef.current ?? onClose)()
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
      closeRef={closeRef}
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
            className="mt-2 w-full resize-none rounded-panel border-[1.5px] border-border bg-surface px-3.5 py-3 text-[12.5px] text-ink outline-none placeholder:text-placeholder focus:border-primary sm:rounded-lg sm:py-2.5 sm:text-[12px]"
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

        {/* Le pendant desktop du panneau ci-dessus : le pied bascule le même
            `recurrenceOpen`, il lui faut une cible au-dessus de `sm`. Posé AVANT
            le pied, comme le calendrier qui s'ouvre vers le haut : sous la barre,
            l'éditeur passerait derrière « Supprimer » et « Terminé ». */}
        {recurrenceOpen && (
          <div className="animate-fade-in mt-4.5 hidden rounded-panel bg-canvas p-3.5 sm:block">
            <RecurrenceEditor
              preset={preset}
              interval={interval}
              weekdays={weekdays}
              onPresetChange={(next) => changeRecurrence({ preset: next, interval: 1 })}
              onIntervalChange={(next) => changeRecurrence({ interval: next })}
              onWeekdaysChange={(next) => changeRecurrence({ weekdays: next })}
            />
          </div>
        )}

        {(updateTask.error || deleteTask.error || skipOccurrence.error) && (
          <Alert className="mt-3">
            {dataErrorMessage(updateTask.error ?? deleteTask.error ?? skipOccurrence.error)}
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
              tooltip={IMPORTANT_TOOLTIP}
              aria-pressed={task.is_important}
              onClick={() => edit({ is_important: !task.is_important })}
            >
              <span aria-hidden>⚑</span> Important
            </ToolbarToggle>
            <ToolbarToggle
              active={preset !== 'none'}
              tooltip={RECURRENCE_TOOLTIP}
              aria-expanded={recurrenceOpen}
              onClick={() => setRecurrenceOpen((v) => !v)}
            >
              <span aria-hidden>↻</span> {recurrenceSummary(rule)}
            </ToolbarToggle>
          </div>

          <div className="flex flex-col gap-2.5 sm:ml-auto sm:flex-row sm:items-center">
            {/* Une feuille ne peut pas ouvrir `TaskDeleteDialog` par-dessus
                elle-même : deux modales écouteraient Échap. Le choix est donc
                posé ici, en dépliant le pied — même copie, même conséquences. */}
            {confirmingDelete && repeats ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    skipOccurrence.mutate(task.id, {
                      onSuccess: () => (closeRef.current ?? onClose)(),
                    })
                  }
                  className={cn(DELETE_CHOICE, 'order-2 bg-canvas text-ink-2 sm:order-none')}
                >
                  {TASK_SKIP_LABEL}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteTask.mutate(task.id, {
                      onSuccess: () => (closeRef.current ?? onClose)(),
                    })
                  }
                  className={cn(DELETE_CHOICE, 'order-3 bg-danger-bg text-danger sm:order-none')}
                >
                  {TASK_SERIES_LABEL}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!confirmingDelete) {
                    setConfirmingDelete(true)
                    return
                  }
                  deleteTask.mutate(task.id, { onSuccess: () => (closeRef.current ?? onClose)() })
                }}
                className={cn(
                  DELETE_CHOICE,
                  'order-2 sm:order-none',
                  confirmingDelete
                    ? 'bg-danger-bg text-danger'
                    : 'text-ink-muted hover:bg-danger-bg hover:text-danger',
                )}
              >
                {confirmingDelete ? 'Confirmer la suppression' : 'Supprimer'}
              </button>
            )}

            {/* La maquette supprime d'un clic ; sans corbeille, on garde la
                confirmation en deux temps. */}
            {confirmingDelete && (
              <p className="order-4 text-caption leading-snug text-ink-muted sm:order-none">
                {repeats
                  ? `${taskRepeatIntro(task.recurrence)} « ${TASK_SERIES_LABEL} » l’arrête pour de bon.`
                  : TASK_DELETE_PERMANENT}
              </p>
            )}

            <button
              type="submit"
              form={formId}
              className={buttonClasses({
                className: cn(
                  'order-1 min-h-12 flex-1 rounded-panel px-4.5 text-ui',
                  'sm:order-none sm:min-h-0 sm:flex-none sm:shrink-0 sm:rounded-md sm:py-2.5 sm:text-[12px]',
                ),
              })}
            >
              Terminé
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
