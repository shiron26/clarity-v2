import { useId, useState, type FormEvent } from 'react'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { FieldHint, FieldLabel } from '../../../components/ui/FieldLabel'
import { Modal } from '../../../components/ui/Modal'
import { UnitField } from '../../../components/ui/UnitField'
import { useAddObjectiveEntry } from '../../../hooks/useObjectiveEntries'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { parseAmount } from '../../../lib/objectiveDraft'
import { formatQuantity } from '../../../lib/objectiveWording'
import { formatDayMonth, type IsoDate } from '../../../lib/appDate'
import type { Objective } from '../../../hooks/useObjectives'
import type { ObjectiveProgress } from '../../../hooks/useObjectiveProgress'

type ObjectiveEntryModalProps = {
  open: boolean
  onClose: () => void
  objective: Objective
  /** Aide contextuelle — jamais une valeur par défaut dans le champ. */
  progress: ObjectiveProgress | undefined
}

/**
 * « Saisir mon relevé ».
 *
 * Une modale et non un popover : c'est une écriture, et perdre un montant à
 * moitié tapé sur un clic extérieur est une vraie perte. La saisie peut aussi
 * échouer côté serveur, ce qui demande une zone de message stable.
 *
 * **Les deux modes doivent se distinguer d'un coup d'œil.** Sans la phrase
 * d'aide, quelqu'un tape le nouveau total en mode cumul et double sa
 * progression — l'erreur est invisible et irrécupérable sans repasser en base.
 *
 * `entry_date` n'est pas envoyée : le serveur la pose au jour applicatif. Deux
 * saisies le même jour créent donc deux lignes — correct en cumul (elles
 * s'ajoutent), et en relevé c'est la dernière qui compte.
 */
export function ObjectiveEntryModal({
  open,
  onClose,
  objective,
  progress,
}: ObjectiveEntryModalProps) {
  const fieldId = useId()
  const formId = useId()
  const [raw, setRaw] = useState('')
  const [touched, setTouched] = useState(false)
  const addEntry = useAddObjectiveEntry()

  const cumul = objective.entry_mode === 'cumul'
  const amount = parseAmount(raw)
  const invalid = raw.trim() !== '' && amount === null
  const notPositive = cumul && amount !== null && amount <= 0

  const error = invalid
    ? 'Indiquez un nombre.'
    : notPositive
      ? 'Un ajout se fait avec un nombre positif.'
      : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (amount === null || error !== null) return
    addEntry.mutate(
      { objectiveId: objective.id, value: amount },
      {
        onSuccess: () => {
          setRaw('')
          setTouched(false)
          onClose()
        },
      },
    )
  }

  const current = progress?.value ?? 0
  const lastDate = progress?.last_entry_date

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cumul ? 'Ajouter à votre total' : 'Saisir votre relevé'}
      className="sm:w-[420px]"
      footer={
        <div className="flex justify-end">
          <Button
            type="submit"
            form={formId}
            loading={addEntry.isPending}
            disabled={raw.trim() === '' || error !== null}
          >
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="pt-1">
        <FieldLabel htmlFor={fieldId}>
          {cumul ? 'Combien ajoutez-vous ?' : 'Où en êtes-vous ?'}
        </FieldLabel>
        <UnitField
          id={fieldId}
          value={raw}
          onChange={(value) => setRaw(value)}
          unit={objective.unit ?? ''}
          placeholder={cumul ? '0' : formatQuantity(current, null)}
          ariaLabel={cumul ? 'Valeur à ajouter' : 'Nouvelle valeur'}
        />

        <FieldHint>
          {cumul ? (
            <>
              Cette valeur s’<b>ajoutera</b> à vos {formatQuantity(current, objective.unit)}.
            </>
          ) : lastDate ? (
            <>
              Vous étiez à <b>{formatQuantity(current, objective.unit)}</b> le{' '}
              {formatDayMonth(lastDate as IsoDate)}. Cette valeur <b>remplace</b> la précédente,
              et elle peut baisser.
            </>
          ) : (
            <>Cette valeur remplace la précédente, et elle peut baisser.</>
          )}
        </FieldHint>

        {touched && error && <Alert className="mt-3">{error}</Alert>}
        {addEntry.error && <Alert className="mt-3">{dataErrorMessage(addEntry.error)}</Alert>}
      </form>
    </Modal>
  )
}
