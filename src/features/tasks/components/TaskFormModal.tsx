import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { CalendarIcon } from '../../../components/icons/CalendarIcon'
import { RepeatIcon } from '../../../components/icons/RepeatIcon'
import { Alert } from '../../../components/ui/Alert'
import { Calendar } from '../../../components/ui/Calendar'
import { Modal } from '../../../components/ui/Modal'
import { Popover } from '../../../components/ui/Popover'
import { Switch } from '../../../components/ui/Switch'
import { useAuth } from '../../auth/useAuth'
import type { List } from '../../../hooks/useLists'
import type { Objective } from '../../../hooks/useObjectives'
import { useCreateTask } from '../../../hooks/useTaskMutations'
import { isoWeekday, type IsoDate } from '../../../lib/appDate'
import { cn } from '../../../lib/cn'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { buildRecurrence, recurrenceSummary, type RecurrencePreset } from '../../../lib/recurrence'
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

type TaskFormModalProps = {
  open: boolean
  onClose: () => void
  principals: Objective[]
  lists: List[]
  today: IsoDate
  /** En vue « liste », la nouvelle tâche naît dans cette liste. */
  defaultListId: string | null
  /** Rang de la nouvelle ligne dans l'ordre manuel. */
  nextPosition: number
}

const LABEL = SHEET_LABEL

export function TaskFormModal({
  open,
  onClose,
  principals,
  lists,
  today,
  defaultListId,
  nextPosition,
}: TaskFormModalProps) {
  const { session } = useAuth()
  const userId = session?.user.id
  const createTask = useCreateTask()
  const formId = useId()
  const titleRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  // `null` = « Aucun ». C'est le défaut : exiger un choix explicite d'objectif
  // couperait l'enchaînement au clavier, où titre + Entrée doit suffire.
  const [objectiveId, setObjectiveId] = useState<string | null>(null)
  const [listId, setListId] = useState<string | null>(defaultListId)
  const [important, setImportant] = useState(false)
  const [dueDate, setDueDate] = useState<IsoDate | null>(today)
  const [preset, setPreset] = useState<RecurrencePreset>('none')
  const [interval, setIntervalValue] = useState(1)
  const [weekdays, setWeekdays] = useState<number[]>([])
  // Deux volets indépendants (maquette) : l'échéance est un popover sur desktop et
  // une section dépliée sur mobile, la récurrence un panneau inline dans les deux cas.
  const [dueOpen, setDueOpen] = useState(false)
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)
  const [chain, setChain] = useState(false)

  const dueTriggerRef = useRef<HTMLButtonElement>(null)

  const resetFields = useCallback(() => {
    setTitle('')
    setDescription('')
    setDescriptionOpen(false)
    setObjectiveId(null)
    setListId(defaultListId)
    setImportant(false)
    setDueDate(today)
    setPreset('none')
    setIntervalValue(1)
    setWeekdays([])
    setDueOpen(false)
    setRecurrenceOpen(false)
  }, [defaultListId, today])

  // Le formulaire repart à neuf à chaque ouverture — jamais de reste de la fois d'avant.
  useEffect(() => {
    if (!open) return
    resetFields()
    setChain(false)
  }, [open, resetFields])

  function changePreset(next: RecurrencePreset) {
    setPreset(next)
    setIntervalValue(1)
    // Une règle hebdomadaire sans jour retombe sur « +7 jours » côté serveur :
    // on préremplit avec le jour de l'échéance choisie.
    if (next === 'weekly' && weekdays.length === 0) setWeekdays([isoWeekday(dueDate ?? today)])
  }

  const recurrence = buildRecurrence(preset, interval, weekdays)
  // Le titre suffit : tout le reste a une valeur par défaut. C'est ce qui permet
  // de créer une série de tâches au clavier seul.
  const ready = title.trim().length > 0

  // `useCreateTask` n'est ni idempotent ni retenté : deux envois concurrents créent
  // deux tâches. Le `disabled` des boutons ne suffit plus maintenant qu'Entrée valide
  // depuis n'importe quel champ — et le mode « à la chaîne » garde le focus dans le
  // formulaire pendant tout l'aller-retour réseau.
  function submitNow() {
    if (!ready || !userId || createTask.isPending) return
    createTask.mutate(
      {
        userId,
        title: title.trim(),
        description: description.trim() || null,
        dueDate,
        objectiveId,
        listId,
        isImportant: important,
        recurrence,
        position: nextPosition,
      },
      {
        onSuccess: () => {
          if (!chain) {
            onClose()
            return
          }
          resetFields()
          // Entrée part souvent d'une pastille, où le focus reste : sans ce rappel
          // la tâche suivante ne peut pas se taper. C'est tout l'intérêt du mode
          // « à la chaîne » — enchaîner sans toucher la souris.
          titleRef.current?.focus()
        },
      },
    )
  }

  /**
   * Entrée valide, où que soit le focus.
   *
   * La soumission implicite d'un formulaire ne part que depuis un champ texte : un
   * `<button>` focalisé consomme Entrée pour s'activer lui-même. Comme choisir un
   * objectif est obligatoire et se fait au clic sur une pastille — qui prend le
   * focus —, Entrée retombait systématiquement sur la pastille et ne validait
   * jamais. D'où l'interception ici plutôt que sur le seul champ titre.
   *
   * Contrepartie : au clavier, Entrée sur une pastille valide le formulaire au lieu
   * de la sélectionner. Espace, lui, l'active toujours — c'est le comportement natif
   * d'un bouton.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    // Seule exception : la description est multi-ligne, Entrée y écrit un saut de ligne.
    if (event.target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    submitNow()
  }

  const dueLabel = dueLabelOf(dueDate, today)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle tâche"
      variant="sheet"
      className="sm:w-[760px]"
    >
      {/* Un vrai formulaire : le clic sur « Ajouter » et la validation clavier
          convergent vers `submitNow()`. */}
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          submitNow()
        }}
        onKeyDown={handleKeyDown}
        className="flex flex-col"
      >
        {/* Mobile : l'importance monte à côté du titre — le pied de feuille est pris
            par l'enchaînement et le bouton d'ajout. Un seul champ, pas deux rendus :
            le bouton disparaît simplement au-dessus de `sm`. */}
        <div className="flex items-stretch gap-2">
          <input
            ref={titleRef}
            value={title}
            data-autofocus
            placeholder="Décrire la tâche…"
            aria-label="Titre de la tâche"
            onChange={(event) => setTitle(event.target.value)}
            className={TITLE_INPUT}
          />
          <button
            type="button"
            aria-pressed={important}
            aria-label="Important"
            title="Important"
            onClick={() => setImportant((v) => !v)}
            className={importantButtonClass(important)}
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
            className="mt-2 w-full resize-none rounded-lg border-[1.5px] border-border bg-canvas px-3.5 py-2.5 text-[12px] text-ink outline-none placeholder:text-placeholder focus:border-primary focus:bg-surface"
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
        <ObjectivePills objectives={principals} value={objectiveId} onChange={setObjectiveId} />

        {lists.length > 0 && (
          <>
            <p className={cn(LABEL, 'mt-3.5 mb-2')}>LISTE</p>
            <ListPills lists={lists} value={listId} onChange={setListId} />
          </>
        )}

        {/* Mobile : échéance et récurrence sont des lignes qu'on déplie, à la
            convention des feuilles — pas de survol pour découvrir un panneau. */}
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
              <Calendar value={dueDate} today={today} size="lg" onChange={setDueDate} />
              <DueQuickLinks
                value={dueDate}
                today={today}
                variant="chip"
                onChange={setDueDate}
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
            <span className="flex-1 text-left text-ui text-ink">
              {recurrenceSummary(recurrence)}
            </span>
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
                onPresetChange={changePreset}
                onIntervalChange={setIntervalValue}
                onWeekdaysChange={setWeekdays}
              />
            </div>
          )}

          {/* La maquette colle ce pied en bas de feuille (`margin-top:auto`) ; le
              panneau de `Modal` n'est pas une colonne flex, donc une marge fixe. */}
          <div className="mt-8 flex flex-col gap-2.5">
            <Switch checked={chain} onChange={setChain} label="Enchaîner une autre tâche après l’ajout">
              <span className="text-body text-ink-3">Enchaîner une autre tâche après l’ajout</span>
            </Switch>

            <button
              type="submit"
              form={formId}
              disabled={!ready || createTask.isPending}
              className={cn(
                'flex min-h-12 w-full cursor-pointer items-center justify-center rounded-panel text-ui font-medium text-white',
                'transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                ready ? 'bg-primary active:bg-primary-active' : 'cursor-default bg-border-idle',
              )}
            >
              Ajouter la tâche
            </button>
          </div>
        </div>

        <div className="mt-4.5 hidden flex-wrap items-center gap-2 border-t border-surface-subtle pt-3.5 sm:flex">
          <div className="flex shrink-0 items-center gap-[3px] rounded-lg bg-field p-1">
            <span className="relative flex">
              <ToolbarToggle
                ref={dueTriggerRef}
                active
                onClick={() => setDueOpen((v) => !v)}
                aria-haspopup="dialog"
                aria-expanded={dueOpen}
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
                <Calendar value={dueDate} today={today} onChange={setDueDate} />
                <DueQuickLinks
                  value={dueDate}
                  today={today}
                  variant="link"
                  onChange={setDueDate}
                />
              </Popover>
            </span>
            <ToolbarToggle
              active={important}
              tone="danger"
              aria-pressed={important}
              onClick={() => setImportant((v) => !v)}
            >
              <span aria-hidden>⚑</span> Important
            </ToolbarToggle>
            <ToolbarToggle
              active={preset !== 'none'}
              aria-expanded={recurrenceOpen}
              onClick={() => setRecurrenceOpen((v) => !v)}
            >
              <span aria-hidden>↻</span> {recurrenceSummary(recurrence)}
            </ToolbarToggle>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <label
              className="flex cursor-pointer items-center gap-2.5 text-label font-medium whitespace-nowrap text-ink-3"
              title="Garder le formulaire ouvert pour enchaîner les tâches"
            >
              Créer à la chaîne
              <Switch checked={chain} onChange={setChain} label="Créer à la chaîne" />
            </label>

            <button
              type="submit"
              form={formId}
              disabled={!ready || createTask.isPending}
              className={cn(
                'shrink-0 cursor-pointer rounded-md px-4.5 py-2.5 text-[12px] font-medium whitespace-nowrap text-white',
                'transition-[background-color,box-shadow,transform] duration-150',
                'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                ready
                  ? 'bg-primary hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active'
                  : 'cursor-default bg-border-idle',
              )}
            >
              Ajouter ↵
            </button>
          </div>
        </div>

        {recurrenceOpen && (
          <div className="animate-fade-in mt-2.5 hidden rounded-panel bg-canvas p-3.5 sm:block">
            <RecurrenceEditor
              preset={preset}
              interval={interval}
              weekdays={weekdays}
              onPresetChange={changePreset}
              onIntervalChange={setIntervalValue}
              onWeekdaysChange={setWeekdays}
            />
          </div>
        )}

        {createTask.error && (
          <Alert className="mt-3">{dataErrorMessage(createTask.error)}</Alert>
        )}

        <p className="mt-2.5 hidden min-h-3.5 text-caption text-ink-muted sm:block">
          Entrée ↵ pour ajouter — le reste a des valeurs par défaut
        </p>
      </form>
    </Modal>
  )
}
