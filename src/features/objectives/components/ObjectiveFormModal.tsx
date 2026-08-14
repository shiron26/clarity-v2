import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { Alert } from '../../../components/ui/Alert'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Textarea } from '../../../components/ui/Textarea'
import type { Objective } from '../../../hooks/useObjectives'
import {
  useCreateObjective,
  useUpdateObjective,
  type ObjectiveKind,
} from '../../../hooks/useObjectiveMutations'
import { dataErrorMessage } from '../../../lib/errorMessage'

// « Quotidien » n'est pas un cas particulier, c'est simplement 7 (SPEC §4.1) :
// la base ne connaît qu'un entier 1–7, le toggle n'est qu'une commodité d'UI.
const DAILY = 7
const CUSTOM_FREQUENCIES = [1, 2, 3, 4, 5, 6]
const DEFAULT_CUSTOM = 3

// Champs des inputs de la maquette : fond canvas, focus en blanc bordé de bleu.
const FIELD = 'bg-canvas focus:bg-surface'

type ObjectiveFormModalProps = {
  open: boolean
  onClose: () => void
  userId: string
  year: number
  /** Nature imposée à la création ; ignorée en édition (elle est immuable). */
  kind: ObjectiveKind
  /** Renseigné = édition. */
  objective?: Objective
}

export function ObjectiveFormModal({
  open,
  onClose,
  userId,
  year,
  kind,
  objective,
}: ObjectiveFormModalProps) {
  const formId = useId()
  const editing = !!objective
  // Un secondaire ne porte jamais de cadence : la contrainte
  // `objective_cadence_shape` l'exige nulle.
  const isPrincipal = (editing ? objective.kind : kind) === 'principal'

  const [title, setTitle] = useState('')
  const [label, setLabel] = useState('')
  const [why, setWhy] = useState('')
  const [description, setDescription] = useState('')
  const [whyOpen, setWhyOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [daily, setDaily] = useState(true)
  const [frequency, setFrequency] = useState(DEFAULT_CUSTOM)

  const createObjective = useCreateObjective()
  const updateObjective = useUpdateObjective()
  const pending = createObjective.isPending || updateObjective.isPending
  const error = createObjective.error ?? updateObjective.error

  // Réinitialiser à chaque ouverture : la modale sert la création ET l'édition.
  // Un champ déjà rempli s'ouvre d'emblée, sinon son contenu serait invisible
  // derrière le lien de révélation.
  useEffect(() => {
    if (!open) return
    setTitle(objective?.title ?? '')
    setLabel(objective?.label ?? '')
    setWhy(objective?.why ?? '')
    setDescription(objective?.description ?? '')
    setWhyOpen(!!objective?.why)
    setDescriptionOpen(!!objective?.description)
    setDaily(objective ? objective.cadence === DAILY : true)
    setFrequency(
      objective?.cadence && objective.cadence !== DAILY ? objective.cadence : DEFAULT_CUSTOM,
    )
    createObjective.reset()
    updateObjective.reset()
    // Les mutations sont stables ; ne réagir qu'à l'ouverture et à la cible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, objective])

  const canSubmit = title.trim().length > 0 && label.trim().length > 0 && !pending

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    const shared = {
      label: label.trim(),
      title: title.trim(),
      why: why.trim() || null,
      description: description.trim() || null,
      cadence: isPrincipal ? (daily ? DAILY : frequency) : null,
    }

    if (editing) {
      updateObjective.mutate({ id: objective.id, edits: shared }, { onSuccess: onClose })
    } else {
      createObjective.mutate({ userId, year, kind, ...shared }, { onSuccess: onClose })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="sm:w-[560px]"
      scrimClassName="sm:pt-35"
      title={
        editing
          ? 'Modifier l’objectif'
          : isPrincipal
            ? 'Nouvel objectif principal'
            : 'Nouvel objectif secondaire'
      }
      footer={
        <div className="flex items-center">
          <button
            type="submit"
            form={formId}
            disabled={!canSubmit}
            className={cn(
              'ml-auto rounded-md px-4.5 py-2.5 text-body font-medium text-white transition-all duration-150',
              'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
              canSubmit
                ? 'cursor-pointer bg-primary shadow-primary hover:-translate-y-px hover:bg-primary-hover hover:shadow-primary-hover active:translate-y-px active:bg-primary-active'
                : 'cursor-default bg-border-idle',
            )}
          >
            {editing ? 'Enregistrer' : 'Créer l’objectif'}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="pt-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l’objectif…"
          aria-label="Titre de l’objectif"
          autoFocus
          required
          className={cn(FIELD, 'py-[13px]')}
        />

        {whyOpen && (
          <Textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Le pourquoi — ce qui vous a décidé, relu quand la motivation baisse."
            aria-label="Pourquoi cet objectif"
            className="mt-2 py-[11px] text-body"
          />
        )}

        {descriptionOpen && (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="La cible, les conditions de réussite…"
            aria-label="Description"
            className="mt-2 py-[11px] text-body"
          />
        )}

        {/* Les liens restants tiennent sur une ligne, séparés — la maquette n'en
            a qu'un, ici il y en a deux et ils ne doivent pas se toucher. */}
        {(!whyOpen || !descriptionOpen) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {!whyOpen && (
              <DisclosureLink onClick={() => setWhyOpen(true)}>
                + Ajouter un pourquoi
              </DisclosureLink>
            )}
            {!descriptionOpen && (
              <DisclosureLink onClick={() => setDescriptionOpen(true)}>
                + Ajouter une description
              </DisclosureLink>
            )}
          </div>
        )}

        <SectionLabel>Label court</SectionLabel>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex. Marathon, Atelier, Lecture…"
          aria-label="Label court"
          required
          className={cn(FIELD, 'py-[11px] text-body')}
        />
        <p className="mt-1.5 text-caption text-ink-muted">
          Utilisé partout où l’espace est réduit (sélecteur d’objectif, badges…)
        </p>

        {isPrincipal && (
          <>
            <SectionLabel>Cadence des tâches liées</SectionLabel>

            {/* Toggle segmenté : « Quotidien » est le cas courant, la fréquence
                fine ne se déplie qu'à la demande. */}
            <div className="flex w-fit items-center gap-[3px] rounded-lg bg-field p-1">
              <Segment selected={daily} onClick={() => setDaily(true)}>
                Quotidien
              </Segment>
              <Segment selected={!daily} onClick={() => setDaily(false)}>
                Cadence personnalisée
              </Segment>
            </div>

            {!daily && (
              <div className="mt-2.5 flex flex-wrap items-center gap-[7px]">
                {CUSTOM_FREQUENCIES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFrequency(n)}
                    aria-pressed={frequency === n}
                    className={cn(
                      'w-10 cursor-pointer rounded-md py-2 text-center text-label transition-all duration-150',
                      'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                      frequency === n
                        ? 'border-[1.5px] border-primary bg-primary-soft font-semibold text-primary'
                        : 'border border-border bg-canvas text-ink-3',
                    )}
                  >
                    {n}×
                  </button>
                ))}
                <span className="ml-1 text-[11px] text-ink-muted">par semaine</span>
              </div>
            )}
          </>
        )}

        {error && <Alert className="mt-4">{dataErrorMessage(error)}</Alert>}
      </form>
    </Modal>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 mb-2 text-[10px] font-semibold tracking-[1.2px] text-ink-muted uppercase">
      {children}
    </div>
  )
}

function DisclosureLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer pt-2 text-left text-[11px] text-ink-muted transition-colors duration-150 hover:text-primary focus-visible:text-primary focus-visible:outline-none"
    >
      {children}
    </button>
  )
}

function Segment({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'cursor-pointer rounded-sm px-3.5 py-2 text-label whitespace-nowrap transition-all duration-150',
        'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
        selected
          // notation à virgules : un `/` dans une valeur arbitraire est lu comme
          // un modificateur d'opacité et la règle n'est jamais générée.
          ? 'bg-surface font-semibold text-ink shadow-[0_2px_5px_rgba(0,0,0,0.1)]'
          : 'font-medium text-ink-3',
      )}
    >
      {children}
    </button>
  )
}
