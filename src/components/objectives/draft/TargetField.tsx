import { useId, useState } from 'react'
import { UnitField } from '../../ui/UnitField'
import { DisclosureLink } from '../../ui/DisclosureLink'
import { FieldHint, FieldLabel } from '../../ui/FieldLabel'
import { CustomUnitInput, UnitSelect } from './UnitSelect'
import { isCustomUnit, type ObjectiveDraft } from '../../../lib/objectiveDraft'

type TargetFieldProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /**
   * Quantité : un select d'unité, parce que la valeur est un montant du monde.
   * Habitude : **aucun select**, suffixe figé « fois » — une habitude se compte
   * en fois par construction, on ne court pas 100 kilos. C'est l'application qui
   * compte, l'unité serait un choix sans objet. « Fois » et non « séances » :
   * c'est le mot de la liste d'unités (`OBJECTIVE_UNITS`), et il vaut aussi pour
   * ce qui n'est pas une séance.
   */
  withUnitSelect: boolean
  label: string
  /**
   * La cible d'une habitude est facultative, et elle est **repliée par défaut**.
   * Un champ vide affiché en permanence se lit comme une case à remplir : « trois
   * fois par semaine en famille » n'a pas de total, et laisser l'encadré ouvert
   * poussait à en inventer un. Replié, il ne coûte rien à qui n'en a pas besoin.
   */
  optional?: boolean
}

/**
 * La cible d'un objectif, avec ou sans unité. Partagée par la création et
 * l'édition : `target_value` et `unit` restent modifiables après coup.
 */
export function TargetField({
  draft,
  onChange,
  withUnitSelect,
  label,
  optional = false,
}: TargetFieldProps) {
  const targetId = useId()

  // « Autre… » ouvre un champ libre. L'état vit ici : une unité personnalisée
  // est, dans le brouillon, une unité comme une autre.
  const [custom, setCustom] = useState(() => isCustomUnit(draft.unit))

  // Le champ facultatif s'ouvre déjà rempli quand l'objectif a une cible —
  // l'édition ne cache pas une valeur existante. `revealed` distingue « ouvert
  // par un clic » (on donne le focus) de « ouvert au montage » (on ne le vole
  // pas).
  const [revealed, setRevealed] = useState(false)
  const open = !optional || revealed || draft.targetValue !== ''

  if (!withUnitSelect) {
    if (!open) {
      return (
        <>
          {/* L'explication d'abord, l'action ensuite : on lit pourquoi on
              pourrait vouloir une cible avant de trouver le bouton qui l'ouvre.
              Un exemple ET son contraire, parce qu'un seul cas ne dit pas où se
              situe le sien : un objectif qui vise un total, un objectif qui n'est
              qu'un rythme. La phrase ne vend pas la cible, elle autorise à s'en
              passer. */}
          <FieldHint className="mt-0">
            Tous les objectifs n’ont pas de total : « courir 100 fois cette année » en vise
            un, « trois fois par semaine en famille » n’est qu’un rythme.
          </FieldHint>
          <DisclosureLink onClick={() => setRevealed(true)} className="mt-2.5">
            Ajouter une cible totale
          </DisclosureLink>
        </>
      )
    }

    return (
      <>
        <FieldLabel htmlFor={targetId} optional={optional}>
          {label}
        </FieldLabel>
        <UnitField
          id={targetId}
          value={draft.targetValue}
          onChange={(targetValue) => onChange({ targetValue })}
          unit="fois"
          placeholder="100"
          ariaLabel="Cible totale en nombre de fois"
          autoFocus={revealed}
        />
        <FieldHint>
          Le total à atteindre sur la période : c’est lui qui permet d’annoncer quand vous y
          serez.
        </FieldHint>
      </>
    )
  }

  return (
    <>
      <FieldLabel htmlFor={targetId} optional={optional}>
        {label}
      </FieldLabel>
      <div className="flex gap-2.5">
        <UnitField
          id={targetId}
          value={draft.targetValue}
          onChange={(targetValue) => onChange({ targetValue })}
          unit={custom ? '' : draft.unit}
          placeholder="6 000"
          ariaLabel="Valeur à atteindre"
          className="min-w-0 flex-1"
        />
        <UnitSelect
          unit={draft.unit}
          onChange={(unit) => onChange({ unit })}
          custom={custom}
          onCustomChange={setCustom}
          wrapperClassName="shrink-0"
        />
      </div>

      {custom && (
        <CustomUnitInput
          unit={draft.unit}
          onChange={(unit) => onChange({ unit })}
          className="mt-2.5"
        />
      )}
    </>
  )
}
