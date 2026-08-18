import { useId } from 'react'
import { Input } from '../../ui/Input'
import { FieldHint, FieldLabel } from '../../ui/FieldLabel'
import { type ObjectiveDraft } from '../../../lib/objectiveDraft'

type GoalQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /** L'onboarding focalise ; dans une modale, `Modal` place déjà le focus. */
  autoFocus?: boolean
}

/**
 * « Qu'est-ce que vous voulez accomplir ? »
 *
 * Aucun « mode » n'est proposé : le parcours fait créer un objectif, il ne
 * configure pas l'application. La question porte sur la vie de la personne,
 * jamais sur le modèle de données.
 *
 * Le nom court n'était pas dans la maquette, mais `objective.label` est requis
 * en base et s'affiche partout où le titre entier ne tient pas. Il a été un
 * temps dérivé du titre à la frappe ; la proposition était souvent à côté
 * (« Passer le permis » donnait PASSER) et se laissait valider telle quelle.
 * C'est l'utilisateur qui l'écrit : deux mots à taper valent mieux qu'une
 * pastille qu'il ne reconnaît pas.
 *
 * Son aide nomme **l'endroit** où on le verra, la pastille d'une tâche, plutôt
 * que la raison abstraite (« là où la place manque ») : personne ne sait à quoi
 * ressemble un manque de place tant qu'il ne l'a pas vu.
 */
export function GoalQuestion({ draft, onChange, autoFocus = false }: GoalQuestionProps) {
  const titleId = useId()
  const labelId = useId()

  return (
    <>
      <FieldLabel htmlFor={titleId}>Votre objectif</FieldLabel>
      <Input
        id={titleId}
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder="Courir 100 fois"
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? '' : undefined}
      />
      <FieldHint>Formulez-le comme vous le diriez à voix haute.</FieldHint>

      <div className="mt-4.5">
        <FieldLabel htmlFor={labelId}>Son nom court</FieldLabel>
        <Input
          id={labelId}
          value={draft.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Courir"
          maxLength={14}
          className="py-[11px] text-body"
        />
        <FieldHint>C’est ce qui s’affiche sur les tâches rattachées à cet objectif. Quelques lettres suffisent.</FieldHint>
      </div>
    </>
  )
}
