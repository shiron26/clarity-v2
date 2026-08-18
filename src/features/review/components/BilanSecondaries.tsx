import { DeckCard } from '../../../components/ritual/DeckCard'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { SECONDARY_SKIN } from '../../../lib/objectivePalette'
import type { Rating } from '../../../lib/reviewRating'
import { RocketRating } from './RocketRating'
import { VerdictChoice } from './VerdictChoice'
import type { Objective } from '../../../hooks/useObjectives'
import type { ReviewItem } from '../../../hooks/useReview'
import { DeckAction } from '../../../components/ritual/DeckAction'

export type SecondaryLine = {
  objective: Objective
  item: ReviewItem | undefined
  /** Le chiffre du trimestre, déjà mis en mots. */
  value: string
  /** Sa fenêtre se ferme ici : on conclut au lieu de noter. */
  verdict: boolean
  /** Pourquoi on conclut plutôt que de noter. `null` quand on note. */
  reason: string | null
}

type BilanSecondariesProps = {
  lines: SecondaryLine[]
  onRate: (objective: Objective, rating: Rating) => void
  onVerdict: (objective: Objective, achieved: boolean) => void
  onNext: () => void
}

/**
 * Les objectifs de second plan — **le seul moment où l'on en reparle**.
 *
 * Ils sont absents du dashboard, du rituel et de la semaine ; ils réapparaissent
 * ici, une fois par trimestre. Et ils reçoivent volontairement **moins de
 * cérémonie** : un écran pour tous, une ligne chacun, une note en fusées
 * compactes, **pas de champ libre**. Un principal a droit à son écran et à ses
 * 280 caractères ; un secondaire à une ligne. La différence de traitement *est*
 * la définition du secondaire — la rattraper effacerait la distinction.
 *
 * Pastille en gris partagé : les secondaires n'ont pas d'identité de slot, on
 * n'est pas censé retenir leur couleur.
 */
export function BilanSecondaries({
  lines,
  onRate,
  onVerdict,
  onNext,
}: BilanSecondariesProps) {
  return (
    <>
      <DeckHeading
        eyebrow={`Secondaires · ${lines.length}`}
        // « Une note suffit » deviendrait faux dès qu'un secondaire se termine
        // ici : ceux-là reçoivent un verdict, pas une note.
        subtitle="On n’en reparlera pas avant trois mois."
      >
        Et vos objectifs de second plan&nbsp;?
      </DeckHeading>

      <div className="mt-6.5 flex w-full flex-col gap-2.5">
        {lines.map(({ objective, item, value, verdict, reason }, index) => (
          <DeckCard key={objective.id} index={index}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: SECONDARY_SKIN.hue }}
                />
                <span className="truncate text-body text-ink-onnight-strong">
                  {objective.title}
                </span>
              </span>
              <span className="shrink-0 text-caption text-ink-onnight-faint">{value}</span>
            </div>

            {verdict ? (
              <>
                {/* Même raison qu'au deck des principaux, en plus court : la
                    place manque, mais la question ne peut pas tomber sans elle. */}
                {reason && (
                  <p className="mb-2.5 text-caption text-ink-onnight-strong">{reason}</p>
                )}
                <VerdictChoice
                  value={item?.achieved ?? null}
                  onChange={(achieved) => onVerdict(objective, achieved)}
                  label={`Verdict — ${objective.title}`}
                  size="compact"
                />
              </>
            ) : (
              <RocketRating
                value={item?.rating ?? null}
                onChange={(rating) => onRate(objective, rating)}
                label={`Note du trimestre — ${objective.title}`}
                size="compact"
              />
            )}
          </DeckCard>
        ))}
      </div>

      <DeckAction
        onClick={onNext}
        className="mt-6.5"
      >
        Continuer →
      </DeckAction>
    </>
  )
}
