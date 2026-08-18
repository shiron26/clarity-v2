import { OptionCard, OptionCardGroup } from '../../ui/OptionCard'
import { QuietNote } from './FeasibilityNote'
import type { ObjectiveDraft } from '../../../lib/objectiveDraft'
import type { ObjectiveMeasure } from '../../../hooks/useObjectives'

/**
 * « Comment comptez-vous avancer dessus ? »
 *
 * La question qui choisit le type d'objectif **sans jamais nommer la
 * typologie** : les trois réponses sont à la première personne, formulées comme
 * on décrirait sa propre façon de faire. L'utilisateur répond sur sa vie, pas
 * sur le modèle de données (REFONTE §2).
 *
 * Elle a d'abord demandé « comment saurez-vous que c'est fait ? », et c'était
 * une fausse piste : **ce n'est pas l'objectif qui donne son type, c'est la
 * manière dont on compte l'avancer.** Passer le permis peut se suivre des trois
 * façons. Un critère d'achèvement pousse mécaniquement vers les jalons dès qu'un
 * objectif a une fin naturelle, et fait rater les deux autres régimes.
 *
 * Conséquence sur les exemples : les descriptions ne citent plus d'objectifs
 * (« courir », « passer le permis »), qui laissaient croire qu'un domaine
 * appartient à une case. Elles décrivent le **mécanisme** et ses unités, et la
 * démonstration est faite par `MeasurePreview` — la carte d'un même objectif,
 * pris dans les trois sens. Elle n'est pas rendue ici : c'est l'onboarding qui
 * la pose, parce que sa place change avec la largeur (au-dessus des réponses en
 * mobile, sur le côté en desktop) et que seule sa coquille connaît cette mise en
 * page. La note du bas n'a donc plus qu'à énoncer le principe : le répéter en
 * mots ferait dire deux fois la même chose.
 *
 * Pour un **secondaire**, la première réponse disparaît : un secondaire n'a pas
 * de cadence, donc pas d'habitude. La contrainte se dit dans la question au lieu
 * d'arriver en `objective_measure_kind` après coup — et la note tombe avec elle,
 * elle parlerait de trois façons dont une n'est pas offerte.
 */
const ANSWERS: ReadonlyArray<{
  measure: ObjectiveMeasure
  title: string
  description: string
}> = [
  {
    measure: 'habitude',
    title: '« Je veux un rythme dans ma semaine »',
    description:
      'Une routine, trois fois par semaine par exemple : vous fixez la fréquence, l’application compte pour vous.',
  },
  {
    measure: 'quantite',
    title: '« Je vise un chiffre »',
    description:
      'Des euros, des kilos, des heures, des pages. Vous saisirez la valeur de temps en temps.',
  },
  {
    measure: 'jalons',
    title: '« Je franchis des étapes »',
    description: 'Une liste courte, cochée au fur et à mesure. Aucun rythme demandé.',
  },
]

type MeasureQuestionProps = {
  draft: ObjectiveDraft
  onChange: (patch: Partial<ObjectiveDraft>) => void
}

export function MeasureQuestion({ draft, onChange }: MeasureQuestionProps) {
  const secondaire = draft.kind === 'secondaire'
  const answers = secondaire ? ANSWERS.filter((a) => a.measure !== 'habitude') : ANSWERS

  return (
    <>
      <OptionCardGroup label="Façon de suivre l’objectif">
        {answers.map((answer) => (
          <OptionCard
            key={answer.measure}
            selected={draft.measure === answer.measure}
            onSelect={() => onChange({ measure: answer.measure })}
            title={answer.title}
            description={answer.description}
          />
        ))}
      </OptionCardGroup>

      {!secondaire && (
        <QuietNote>
          <b>Ce n’est pas l’objectif qui décide, c’est votre façon de l’aborder.</b> L’exemple
          montré est le même objectif dans les trois cas.
        </QuietNote>
      )}
    </>
  )
}
