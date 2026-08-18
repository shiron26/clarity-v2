import { useId } from 'react'
import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { MAX_UNIT_LENGTH, OBJECTIVE_UNITS, OTHER_UNIT } from '../../../lib/objectiveDraft'

/**
 * Le choix d'unité d'une quantité : une liste fermée, plus « Autre… » qui ouvre
 * un champ libre.
 *
 * Extrait de `TargetField` parce que deux écrans le posent **à deux endroits
 * différents** : collé au champ de valeur dans l'édition, et dans la ligne de
 * titre du bloc sur l'écran de réglage, où le select ne tient pas à côté de deux
 * champs de valeur. Les deux morceaux sont donc rendus séparément, et l'état
 * « le champ libre est ouvert » reste chez l'appelant — c'est lui qui sait où
 * poser l'un et l'autre.
 *
 * Pourquoi une liste fermée plutôt qu'une saisie libre seule : sans elle,
 * chacun écrirait €, euros, EUR. Et pourquoi une soupape quand même : une liste
 * fermée ne peut pas tout prévoir.
 */

type UnitSelectProps = {
  /** L'unité du brouillon. Chaîne vide = sans unité. */
  unit: string
  onChange: (unit: string) => void
  /** Le champ libre est-il ouvert ? Piloté par l'appelant, qui le rend où il veut. */
  custom: boolean
  onCustomChange: (custom: boolean) => void
  wrapperClassName?: string
}

export function UnitSelect({
  unit,
  onChange,
  custom,
  onCustomChange,
  wrapperClassName,
}: UnitSelectProps) {
  return (
    <Select
      aria-label="Unité de la cible"
      value={custom ? OTHER_UNIT : unit}
      onChange={(e) => {
        if (e.target.value === OTHER_UNIT) {
          onCustomChange(true)
          // L'unité repart à vide : le champ libre qui s'ouvre est le seul à
          // pouvoir la dire, et garder l'ancienne la ferait valider sans saisie.
          onChange('')
          return
        }
        onCustomChange(false)
        onChange(e.target.value)
      }}
      wrapperClassName={wrapperClassName}
    >
      {OBJECTIVE_UNITS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

/**
 * Le champ libre ouvert par « Autre… ». À rendre là où la place existe.
 *
 * Plafonné à `MAX_UNIT_LENGTH` : l'unité est un **suffixe**, rendu deux fois sur
 * la carte et une fois de plus dans chaque saisie. Le plafond laisse passer un
 * mot, même long (« candidatures »), et refuse la phrase.
 */
export function CustomUnitInput({
  unit,
  onChange,
  className,
}: {
  unit: string
  onChange: (unit: string) => void
  className?: string
}) {
  const id = useId()

  return (
    <Input
      id={id}
      value={unit}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Votre unité : « chapitres », « séries »…"
      aria-label="Unité personnalisée"
      maxLength={MAX_UNIT_LENGTH}
      autoFocus
      className={className}
    />
  )
}
