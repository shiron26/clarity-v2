import { OptionCard, OptionCardGroup } from '../../ui/OptionCard'
import { FieldHint } from '../../ui/FieldLabel'
import { QuietNote } from './FeasibilityNote'
import { MAX_PRINCIPALS, MAX_SECONDARIES } from '../../../hooks/useObjectives'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { ObjectiveKind } from '../../../hooks/useObjectiveMutations'

type NatureQuestionProps = {
  draft: ObjectiveDraft
  /** La nature ne se patche pas, elle se normalise — voir `withKind`. */
  onSelectKind: (kind: ObjectiveKind) => void
  /** Places occupées aujourd'hui, arrêtés compris — les mêmes que le rail. */
  principalSlotsUsed: number
  secondarySlotsUsed: number
}

/**
 * « Quelle place doit-il prendre ? »
 *
 * **La question qui manquait.** Elle était déduite du nombre de places libres,
 * jamais posée — avec deux conséquences invisibles et symétriques : les trois
 * places prises, la mesure « habitude » disparaissait sans un mot (un secondaire
 * ne peut pas en être une) ; une place libre, il devenait impossible de créer un
 * secondaire alors qu'on a droit à cinq.
 *
 * La différence entre les deux natures n'est pas une hiérarchie d'importance,
 * c'est une différence de **demande** : un principal vous sollicite chaque
 * semaine, un secondaire ne demande rien jusqu'au bilan du trimestre.
 *
 * Une nature pleine **reste affichée**, avec son compte de places : c'est la seule
 * façon de faire comprendre qu'un objectif arrêté garde sa place jusqu'à la fin
 * de sa fenêtre (les contraintes d'exclusion portent sur `window_range`, pas sur
 * `closed_at`). Le POURQUOI, lui, ne s'écrit qu'une fois, dans la note du bas :
 * répété dans la carte, il faisait une description de cinq lignes que personne ne
 * lit avant de cliquer.
 */
export function NatureQuestion({
  draft,
  onSelectKind,
  principalSlotsUsed,
  secondarySlotsUsed,
}: NatureQuestionProps) {
  const principalLeft = Math.max(0, MAX_PRINCIPALS - principalSlotsUsed)
  const secondaryLeft = Math.max(0, MAX_SECONDARIES - secondarySlotsUsed)
  const allFull = principalLeft === 0 && secondaryLeft === 0

  return (
    <>
      <OptionCardGroup label="Nature de l’objectif">
        <OptionCard
          selected={draft.kind === 'principal'}
          disabled={principalLeft === 0}
          onSelect={() => onSelectKind('principal')}
          title="Un objectif principal"
          description={
            <>
              Un rythme chaque semaine, et il passe au rituel du dimanche.
              <br />
              <b>
                {principalLeft === 0
                  ? `Les ${MAX_PRINCIPALS} places sont prises.`
                  : placesLeft(principalLeft, MAX_PRINCIPALS)}
              </b>
            </>
          }
        />
        <OptionCard
          selected={draft.kind === 'secondaire'}
          disabled={secondaryLeft === 0}
          onSelect={() => onSelectKind('secondaire')}
          title="Un objectif secondaire"
          description={
            <>
              Aucun rythme demandé. On en reparle au bilan du trimestre.
              <br />
              <b>
                {secondaryLeft === 0
                  ? `Les ${MAX_SECONDARIES} places sont prises.`
                  : placesLeft(secondaryLeft, MAX_SECONDARIES)}
              </b>
            </>
          }
        />
      </OptionCardGroup>

      {allFull ? (
        <QuietNote>
          <b>Toutes vos places sont occupées.</b> Une place se libère à la fin de la période
          d’un objectif, ou si vous le supprimez.
        </QuietNote>
      ) : (
        <FieldHint>Ce choix ne se change plus après création.</FieldHint>
      )}
    </>
  )
}

/** « Il reste une place sur 3 » — l'accord compte, le chiffre seul sonne faux. */
function placesLeft(left: number, total: number): string {
  return left === 1 ? `Il reste une place sur ${total}.` : `Il reste ${left} places sur ${total}.`
}
