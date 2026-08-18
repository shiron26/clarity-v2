import { FeasibilityNote, NoteAside } from './FeasibilityNote'
import { CadenceField } from './CadenceField'
import { TargetField } from './TargetField'
import { habitProjection } from '../../../lib/objectiveFeasibility'
import { parseAmount, type ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { IsoDate } from '../../../lib/appDate'

type HabitQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  today: IsoDate
  year: number
}

/**
 * « À quel rythme ? »
 *
 * La cadence appartient à l'objectif, pas à l'application. **Aucune unité à
 * choisir ici** : une habitude se compte en fois par construction — on ne
 * court pas 100 kilos.
 *
 * La cible totale est **facultative** : « courir 100 fois » en a une, « méditer
 * tous les jours » n'en a pas — et sans cible, pas de projection, seulement de
 * la régularité.
 */
export function HabitQuestion({ draft, onChange, today, year }: HabitQuestionProps) {
  const target = parseAmount(draft.targetValue)
  const projection = habitProjection({
    today,
    year,
    quarter: draft.quarter,
    unit: draft.periodUnit,
    cadence: draft.cadence,
    target,
  })

  const periodWord = draft.periodUnit === 'week' ? 'semaine' : 'mois'
  const periodsWord =
    draft.periodUnit === 'week'
      ? `${projection.periodsLeft} semaine${projection.periodsLeft > 1 ? 's' : ''}`
      : `${projection.periodsLeft} mois`

  return (
    <>
      <CadenceField draft={draft} onChange={onChange} />

      <div className="mt-5.5">
        <TargetField
          draft={draft}
          onChange={onChange}
          withUnitSelect={false}
          label="Cible totale"
          optional
        />
      </div>

      {/* Une phrase, un chiffre : ce que la cadence produit d'ici la fin de la
          fenêtre. La proposition qui suit ne s'ajoute que s'il y a une cible à
          comparer — sans cible il n'y a pas de verdict, et le dire ici
          répéterait l'aide du champ juste au-dessus. */}
      <FeasibilityNote>
        À ce rythme, vous y reviendrez <b>{projection.projected} fois</b> en {periodsWord}.{' '}
        {projection.reachable === true && (
          <NoteAside>Votre cible de {target} est à portée.</NoteAside>
        )}
        {projection.reachable === false && (
          <NoteAside>
            Il en manquerait {target! - projection.projected} : une fois de plus par{' '}
            {periodWord}, ou une cible plus basse.
          </NoteAside>
        )}
      </FeasibilityNote>
    </>
  )
}
