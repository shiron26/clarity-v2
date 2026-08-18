import { useState, type FormEvent } from 'react'
import { cn } from '../../../lib/cn'
import { CheckIcon } from '../../../components/icons/CheckIcon'
import { Alert } from '../../../components/ui/Alert'
import type { Milestone } from '../../../hooks/useMilestones'
import type { Objective } from '../../../hooks/useObjectives'
import {
  useCreateMilestone,
  useDeleteMilestone,
  useToggleMilestone,
} from '../../../hooks/useMilestoneMutations'
import { maskTitle, objectiveSkin } from '../../../lib/objectivePalette'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { SECTION_LABEL } from '../../../components/ui/sectionLabel'

/** Contrainte serveur `milestone_cap` — on la reflète dans l'UI. */
const MAX_PER_QUARTER = 4

type MilestoneListProps = {
  objective: Objective
  milestones: Milestone[]
  quarter: number
  /** « Jalons · T3 » sur une habitude, « Les étapes » sur un objectif jalonné —
   *  c'est le même objet, mais il n'a pas le même statut dans les deux écrans. */
  title?: string
  privacy?: boolean
  readOnly?: boolean
}

/**
 * Jalons du trimestre affiché. Cocher ne produit aucun signal ailleurs : pas de
 * jour actif, pas de compteur (SPEC §3, principe des deux tempos).
 *
 * Aucun déplacement entre trimestres n'est proposé — c'est interdit côté base
 * et voulu par la spec : pour poursuivre un jalon, on le réécrit ailleurs.
 */
export function MilestoneList({
  objective,
  milestones,
  quarter,
  title: heading,
  privacy = false,
  readOnly = false,
}: MilestoneListProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const createMilestone = useCreateMilestone()
  const toggleMilestone = useToggleMilestone()
  const deleteMilestone = useDeleteMilestone()

  const skin = objectiveSkin(objective.slot)
  const doneCount = milestones.filter((m) => m.completed_at !== null).length
  const full = milestones.length >= MAX_PER_QUARTER

  const error = createMilestone.error ?? toggleMilestone.error ?? deleteMilestone.error

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    createMilestone.mutate(
      {
        objectiveId: objective.id,
        year: objective.year,
        quarter,
        title: value,
        position: milestones.length,
      },
      {
        onSuccess: () => {
          setTitle('')
          setAdding(false)
        },
      },
    )
  }

  return (
    <div className="border-t border-surface-subtle px-5.5 py-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className={SECTION_LABEL}>
          {heading ?? `Jalons · T${quarter}`}
        </h3>
        <span className="text-caption text-ink-muted">
          {doneCount} / {milestones.length}
        </span>
      </div>

      <div className="flex flex-col">
        {milestones.map((milestone) => {
          const done = milestone.completed_at !== null
          return (
            <div key={milestone.id} className="group flex items-center gap-2.5 py-2">
              <button
                type="button"
                onClick={() =>
                  toggleMilestone.mutate({ id: milestone.id, completed: !done })
                }
                disabled={readOnly}
                aria-pressed={done}
                aria-label={`${done ? 'Décocher' : 'Cocher'} « ${milestone.title} »`}
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-xs border-2 transition-all duration-150',
                  'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
                  readOnly ? 'cursor-default' : 'cursor-pointer',
                  !done && 'border-[#d8d7d0]',
                )}
                style={done ? { borderColor: skin.core, backgroundColor: skin.core } : undefined}
              >
                {done && <CheckIcon className="size-2.5 text-white" />}
              </button>

              <span
                className={cn(
                  'min-w-0 flex-1 text-body',
                  done ? 'text-ink-muted line-through' : 'text-ink',
                )}
              >
                {privacy ? maskTitle(milestone.title) : milestone.title}
              </span>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => deleteMilestone.mutate(milestone.id)}
                  aria-label={`Supprimer « ${milestone.title} »`}
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-ink-muted opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}

        {!readOnly && adding && (
          <form onSubmit={handleSubmit} className="flex items-center gap-2.5 py-2">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title.trim() && setAdding(false)}
              placeholder="Titre du jalon…"
              aria-label="Titre du jalon"
              className="min-w-0 flex-1 rounded-md border-[1.5px] border-border bg-surface px-3 py-2 text-body outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!title.trim() || createMilestone.isPending}
              className="cursor-pointer rounded-md px-3 py-2 text-[11.5px] font-medium text-primary disabled:cursor-default disabled:text-ink-muted"
            >
              Ajouter
            </button>
          </form>
        )}

        {!readOnly && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={full}
            title={full ? 'Quatre jalons maximum par trimestre' : undefined}
            className={cn(
              'cursor-pointer pt-2.5 pb-0 text-left text-[11.5px] transition-colors duration-150',
              full ? 'cursor-default text-ink-muted/70' : 'text-ink-muted hover:text-primary',
            )}
          >
            {full ? 'Quatre jalons maximum par trimestre' : '+ Ajouter un jalon'}
          </button>
        )}
      </div>

      {error && <Alert className="mt-3">{dataErrorMessage(error)}</Alert>}
    </div>
  )
}
