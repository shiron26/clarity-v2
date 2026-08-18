import { useEffect, useId, useState } from 'react'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Divider } from '../../../components/ui/Divider'
import { FieldHint, FieldLabel } from '../../../components/ui/FieldLabel'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Textarea } from '../../../components/ui/Textarea'
import { CadenceField } from '../../../components/objectives/draft/CadenceField'
import { DisclosureLink } from '../../../components/ui/DisclosureLink'
import { TargetField } from '../../../components/objectives/draft/TargetField'
import { useUpdateObjective } from '../../../hooks/useObjectiveMutations'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { objectiveIdentityLine } from '../../../lib/objectiveWording'
import {
  directionOf,
  draftFromObjective,
  emptyDraft,
  isScopeReady,
  parseAmount,
  type ObjectiveDraft,
} from '../../../lib/objectiveDraft'
import type { Objective } from '../../../hooks/useObjectives'

type ObjectiveEditModalProps = {
  open: boolean
  onClose: () => void
  /** Reste renseigné pendant la sortie animée de `Modal` (360 ms). */
  objective: Objective | undefined
}

/**
 * Modifier un objectif — **un seul écran, et rien d'inerte dessus**.
 *
 * Modifier un titre ou une cadence n'est pas un parcours : on ouvre, on change
 * une chose, on ferme. D'où une modale simple là où la création est un assistant.
 *
 * Le gain tient en une règle : **ce qui est figé n'est plus rendu comme un
 * contrôle.** La version précédente affichait un segmented grisé pour l'unité de
 * période et deux cartes grisées pour le mode de saisie — trois contrôles qui
 * invitaient au clic pour rien, et qui faisaient tout le bruit de l'écran. Ils
 * deviennent une ligne de lecture sous le titre. Un objectif jalonné passe ainsi
 * de neuf champs, dont cinq morts, à trois champs vivants.
 *
 * Ce qui reste figé, et pourquoi : `measure`, `period_unit`, `entry_mode`,
 * `quarter`, `year`, `kind` et `slot` (`objective_identity_immutable`) —
 * changer l'unité de période orphelinerait l'historique d'`objective_period`, et
 * basculer cumul → relevé changerait rétroactivement le sens des saisies passées.
 */
export function ObjectiveEditModal({ open, onClose, objective }: ObjectiveEditModalProps) {
  const formId = useId()
  const labelId = useId()

  const [draft, setDraft] = useState<ObjectiveDraft>(() => emptyDraft('principal'))
  const [whyOpen, setWhyOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)

  const updateObjective = useUpdateObjective()

  useEffect(() => {
    if (!open || !objective) return
    setDraft(draftFromObjective(objective))
    setWhyOpen(!!objective.why)
    setDescriptionOpen(!!objective.description)
    updateObjective.reset()
    // La mutation est stable ; ne réagir qu'à l'ouverture et à la cible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, objective])

  function patch(next: Partial<ObjectiveDraft>) {
    setDraft((current) => ({ ...current, ...next }))
  }

  const ready = isScopeReady(draft, 'edit') && !updateObjective.isPending

  function handleSubmit() {
    if (!objective || !ready) return
    updateObjective.mutate(
      {
        id: objective.id,
        edits: {
          label: draft.label.trim(),
          title: draft.title.trim(),
          why: draft.why,
          description: draft.description,
          cadence: draft.measure === 'habitude' ? draft.cadence : null,
          targetValue: draft.measure === 'jalons' ? null : parseAmount(draft.targetValue),
          unit: draft.measure === 'quantite' && draft.unit !== '' ? draft.unit : null,
          // Recalculée, pas recopiée : la cible est modifiable, donc bouger de 70
          // à 85 kg quand on part de 78 retourne le sens de l'objectif. Même
          // déduction qu'à la création — le point de départ, lui, est figé.
          direction:
            draft.measure === 'quantite'
              ? directionOf(objective.start_value ?? 0, parseAmount(draft.targetValue))
              : null,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Modifier l’objectif"
      className="sm:w-[480px]"
      footer={
        <div className="flex justify-end">
          <Button
            type="submit"
            form={formId}
            disabled={!ready}
            loading={updateObjective.isPending}
          >
            Enregistrer
          </Button>
        </div>
      }
    >
      {objective && (
        <>
          <p className="text-caption text-ink-muted">{objectiveIdentityLine(objective)}</p>
          <FieldHint>
            Figé à la création. Changer de nature, c’est créer un nouvel objectif — la
            suppression, elle, reste libre.
          </FieldHint>

          <form
            id={formId}
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="mt-4"
          >
            <Input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Titre de l’objectif"
              aria-label="Titre de l’objectif"
              data-autofocus
              required
              className="py-[13px]"
            />

            {whyOpen && (
              <Textarea
                value={draft.why ?? ''}
                onChange={(e) => patch({ why: e.target.value || null })}
                placeholder="Le pourquoi — ce qui vous a décidé, relu quand la motivation baisse."
                aria-label="Pourquoi cet objectif"
                className="mt-2 py-[11px] text-body"
              />
            )}

            {descriptionOpen && (
              <Textarea
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value || null })}
                placeholder="La cible, les conditions de réussite…"
                aria-label="Description"
                className="mt-2 py-[11px] text-body"
              />
            )}

            {(!whyOpen || !descriptionOpen) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {!whyOpen && (
                  <DisclosureLink onClick={() => setWhyOpen(true)}>
                    Ajouter un pourquoi
                  </DisclosureLink>
                )}
                {!descriptionOpen && (
                  <DisclosureLink onClick={() => setDescriptionOpen(true)}>
                    Ajouter une description
                  </DisclosureLink>
                )}
              </div>
            )}

            <div className="mt-4">
              <FieldLabel htmlFor={labelId}>Nom court</FieldLabel>
              <Input
                id={labelId}
                value={draft.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="Ex. Marathon, Épargne, Permis…"
                maxLength={14}
                required
                className="py-[11px] text-body"
              />
              <FieldHint>C’est ce qui s’affiche sur les tâches rattachées à cet objectif. Quelques lettres suffisent.</FieldHint>
            </div>

            {/* Deux groupes : ce que l'objectif EST, puis ce qu'il DEMANDE. */}
            {objective.measure !== 'jalons' && <Divider className="my-5" />}

            {objective.measure === 'habitude' && (
              <>
                <CadenceField draft={draft} onChange={patch} showPeriodUnit={false} />
                <div className="mt-5">
                  <TargetField
                    draft={draft}
                    onChange={patch}
                    withUnitSelect={false}
                    label="Cible totale"
                    optional
                  />
                </div>
              </>
            )}

            {objective.measure === 'quantite' && (
              <TargetField
                draft={draft}
                onChange={patch}
                withUnitSelect
                label="Votre cible"
              />
            )}

            {objective.measure === 'jalons' && (
              <FieldHint>
                Les étapes se modifient sur la page de l’objectif, là où elles se cochent.
              </FieldHint>
            )}

            {updateObjective.error && (
              <Alert className="mt-4">{dataErrorMessage(updateObjective.error)}</Alert>
            )}
          </form>
        </>
      )}
    </Modal>
  )
}

