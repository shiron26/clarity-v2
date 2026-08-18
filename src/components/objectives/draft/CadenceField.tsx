import type { ReactNode } from 'react'
import { SegmentedGroup } from '../../ui/SegmentedGroup'
import { OptionCard, OptionCardGroup } from '../../ui/OptionCard'
import { WeekIcon } from '../../icons/WeekIcon'
import { MonthIcon } from '../../icons/MonthIcon'
import { FieldLabel } from '../../ui/FieldLabel'
import { MAX_WEEKLY_CADENCE, type ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { PeriodUnit } from '../../../hooks/useObjectivePeriods'

const CADENCES = Array.from({ length: MAX_WEEKLY_CADENCE }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))

/**
 * Deux réponses seulement : des cartes, pas un segmented (voir `SegmentedGroup`).
 * Le gain n'est pas cosmétique — « Semaine » et « Mois » ne disent pas quand le
 * compteur repart, et c'est précisément ce qu'on choisit ici.
 */
const UNITS: Array<{
  value: PeriodUnit
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    value: 'week',
    label: 'Semaine',
    description: 'Le compteur repart chaque lundi.',
    icon: <WeekIcon className="size-5" />,
  },
  {
    value: 'month',
    label: 'Mois',
    description: 'Le compteur repart le 1ᵉʳ du mois.',
    icon: <MonthIcon className="size-5" />,
  },
]

type CadenceFieldProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  /**
   * L'unité de période est **figée après création** (`objective_identity_immutable` :
   * la changer orphelinerait l'historique d'`objective_period`). L'édition ne
   * rend donc pas le contrôle du tout — un segmented grisé inviterait au clic
   * pour rien.
   */
  showPeriodUnit?: boolean
}

/**
 * Le rythme d'une habitude : sur quelle période, puis combien de fois.
 *
 * La période vient **avant** le nombre, parce que le nombre n'a pas de sens sans
 * elle : « 3 » se lit trois fois par semaine ou trois fois par mois, deux rythmes
 * sans rapport. Dans cet ordre, la question du nombre peut nommer la période
 * choisie (« Combien de fois par semaine ? ») et le choix se lit sans avoir à
 * remonter d'un cran.
 *
 * Partagé entre la création et l'édition — c'est le seul réglage d'une habitude
 * qui reste modifiable après coup, et c'est voulu : l'ajustement de cadence est
 * tout l'objet du retour après absence (§9). Baisser une cadence n'est pas un
 * échec.
 */
export function CadenceField({ draft, onChange, showPeriodUnit = true }: CadenceFieldProps) {
  const periodWord = draft.periodUnit === 'week' ? 'semaine' : 'mois'

  return (
    <>
      {showPeriodUnit && (
        <div className="mb-4.5">
          <FieldLabel>Sur quelle période ?</FieldLabel>
          <OptionCardGroup label="Unité de période" columns={2}>
            {UNITS.map((unit) => (
              <OptionCard
                key={unit.value}
                selected={draft.periodUnit === unit.value}
                onSelect={() => onChange({ periodUnit: unit.value })}
                icon={unit.icon}
                title={unit.label}
                description={unit.description}
              />
            ))}
          </OptionCardGroup>
        </div>
      )}

      <FieldLabel>{`Combien de fois par ${periodWord} ?`}</FieldLabel>
      <SegmentedGroup
        label={`Nombre de fois par ${periodWord}`}
        value={String(draft.cadence)}
        onChange={(v) => onChange({ cadence: Number(v) })}
        options={CADENCES}
        className="flex-nowrap [&>button]:flex-1"
      />
    </>
  )
}
