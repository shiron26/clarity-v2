import { OptionCard, OptionCardGroup } from '../../ui/OptionCard'
import { weeksLeftInQuarter } from '../../../lib/objectiveFeasibility'
import { quarterOf, type IsoDate } from '../../../lib/appDate'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'

/**
 * « Sur combien de temps ? »
 *
 * La question annuel / trimestriel se règle ici, formulée comme une durée —
 * jamais comme un choix d'architecture. Les mots « annuel » et « trimestriel »
 * n'apparaissent pas.
 *
 * Chaque option dit **deux choses** : jusqu'à quand elle court (une date, pas un
 * numéro de trimestre) et pour quel genre d'objectif elle est faite. Sans la
 * seconde, le choix se fait à pile ou face — c'est la durée qui décide du
 * régime, et personne ne le devine à la première ouverture.
 *
 * Les options sont **contextuelles** : l'année en cours, le trimestre en cours,
 * et le suivant s'il tombe dans la même année civile. En T4 il n'en reste donc
 * que deux — un objectif ne dépasse pas le 31 décembre, c'est ce que dit le
 * sous-titre, et `useObjectives` ne charge qu'une année à la fois.
 *
 * **Le trimestre prochain n'est pas proposé à l'onboarding** (`allowNextQuarter`).
 * Le parcours de bienvenue existe pour faire démarrer quelqu'un : un premier
 * objectif calé sur une fenêtre qui n'a pas commencé rend un dashboard vide,
 * sans séance attendue ni place occupée, jusqu'au premier jour du trimestre.
 * Programmer à l'avance suppose de connaître le rythme du produit — c'est
 * l'assistant de l'écran Objectifs qui l'ouvre, pas la première ouverture.
 */
const QUARTER_END = ['31 mars', '30 juin', '30 septembre', '31 décembre']
const QUARTER_START = ['1ᵉʳ janvier', '1ᵉʳ avril', '1ᵉʳ juillet', '1ᵉʳ octobre']

type HorizonQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
  today: IsoDate
  year: number
  /** `false` à l'onboarding : le premier objectif commence aujourd'hui. */
  allowNextQuarter?: boolean
}

export function HorizonQuestion({
  draft,
  onChange,
  today,
  year,
  allowNextQuarter = true,
}: HorizonQuestionProps) {
  const currentQuarter = quarterOf(today)
  const nextQuarter = allowNextQuarter && currentQuarter < 4 ? currentQuarter + 1 : null
  const weeksLeft = weeksLeftInQuarter(today, year, currentQuarter)

  return (
    <OptionCardGroup label="Durée de l’objectif">
      <OptionCard
        selected={draft.quarter === null}
        onSelect={() => onChange({ quarter: null })}
        title={`Toute l’année ${year}`}
        description="Pour un objectif de fond, avec un point à chaque trimestre."
      />
      <OptionCard
        selected={draft.quarter === currentQuarter}
        onSelect={() => onChange({ quarter: currentQuarter })}
        title={`Ce trimestre, jusqu’au ${QUARTER_END[currentQuarter - 1]}`}
        description={
          weeksLeft > 1
            ? `Il reste ${weeksLeft} semaines. Pour quelque chose de court et net.`
            : 'C’est la dernière semaine du trimestre.'
        }
      />
      {nextQuarter !== null && (
        <OptionCard
          selected={draft.quarter === nextQuarter}
          onSelect={() => onChange({ quarter: nextQuarter })}
          title={`Le trimestre prochain, du ${QUARTER_START[nextQuarter - 1]} au ${QUARTER_END[nextQuarter - 1]}`}
          description="Pour démarrer sur un trimestre entier, sans entamer celui-ci."
        />
      )}
    </OptionCardGroup>
  )
}
