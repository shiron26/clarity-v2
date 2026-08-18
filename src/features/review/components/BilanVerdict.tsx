import { DeckDensity } from '../../../components/ritual/DeckDensity'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { cn } from '../../../lib/cn'
import { objectiveSkinOf } from '../../../lib/objectivePalette'
import type { QuarterCell } from '../../../lib/quarterTimeline'
import type { Rating } from '../../../lib/reviewRating'
import { CommentField } from './CommentField'
import { RocketRating } from './RocketRating'
import { VerdictChoice } from './VerdictChoice'
import { verdictEyebrow } from '../bilanContent'
import type { Objective } from '../../../hooks/useObjectives'
import type { ReviewItem } from '../../../hooks/useReview'
import { DeckAction } from '../../../components/ritual/DeckAction'
import { DeckEyebrow } from '../../../components/ritual/DeckEyebrow'

type BilanVerdictProps = {
  objective: Objective
  /** Rang dans la file, à partir de 0 — l'écran se rejoue pour chaque principal. */
  index: number
  total: number
  item: ReviewItem | undefined
  /** Le chiffre du trimestre et sa sous-ligne, déjà mis en mots. */
  value: string
  detail: string
  /** Les 13 semaines (ou 3 mois) de la période, dans l'unité de l'objectif. */
  cells: QuarterCell[]
  /** `true` quand la fenêtre de l'objectif se ferme ici : on conclut au lieu de noter. */
  verdict: boolean
  /** Pourquoi on conclut plutôt que de noter. `null` quand on note. */
  reason: string | null
  onRate: (rating: Rating) => void
  onVerdict: (achieved: boolean) => void
  onComment: (comment: string | null) => void
  onNext: () => void
}

/**
 * Le verdict d'un objectif principal — **un objectif à la fois**.
 *
 * C'est l'écran de notation d'avant, repris tel quel : les fusées, la note libre
 * de 280 caractères, le rythme de la période. La seule nouveauté est la forme du
 * jugement — un objectif dont la fenêtre se ferme reçoit un verdict plutôt qu'une
 * note (`verdictExpected`, REFONTE §8). Les deux ne cohabitent jamais sur une même
 * ligne, la base le refuse (`review_item_verdict_exclusive`).
 *
 * Rien n'est obligatoire : « suivant » avance qu'on ait tranché ou non. Un bilan
 * validé signifie « la séance a eu lieu », pas « tout est rempli » (SPEC §4.4).
 */
export function BilanVerdict({
  objective,
  index,
  total,
  item,
  value,
  detail,
  cells,
  verdict,
  reason,
  onRate,
  onVerdict,
  onComment,
  onNext,
}: BilanVerdictProps) {
  const skin = objectiveSkinOf(objective)
  const last = index === total - 1

  return (
    <>
      <DeckHeading eyebrow={verdictEyebrow(index, total)}>{objective.title}</DeckHeading>

      {/* Où l'on en est dans la file. Décoratives : le rang est déjà dans le
          sur-titre, en toutes lettres. */}
      <div aria-hidden className="mt-4 flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn('size-2.5 rounded-full', i > index && 'bg-deck-idle')}
            style={i <= index ? { backgroundColor: skin.core } : undefined}
          />
        ))}
      </div>

      <p className="animate-slide-up mt-3 text-body text-ink-onnight">
        {value}
        {detail && <span className="text-ink-onnight-faint"> · {detail}</span>}
      </p>

      {verdict ? (
        <>
          {/* La raison avant la question : sans elle, deux objectifs voisins —
              l'un noté, l'autre sommé de conclure — se distinguent sans qu'on
              sache pourquoi. */}
          {/* Plus lisible que le chiffre au-dessus, pas moins : c'est cette ligne
              qui rend la question légitime, elle ne peut pas être la plus pâle
              de l'écran. */}
          {reason && (
            <p className="animate-slide-up mt-5 text-body text-ink-onnight-strong">{reason}</p>
          )}
          <VerdictChoice
            value={item?.achieved ?? null}
            onChange={onVerdict}
            label={`Verdict — ${objective.title}`}
          />
        </>
      ) : (
        <RocketRating
          value={item?.rating ?? null}
          onChange={onRate}
          label={`Note du trimestre — ${objective.title}`}
        />
      )}

      <CommentField
        value={item?.comment ?? ''}
        onCommit={onComment}
        placeholder="Notes sur le trimestre…"
        label={`Notes sur « ${objective.title} »`}
      />

      {/* Un objectif jalonné n'a pas de rythme : l'absence de bande le dit mieux
          qu'une piste plate — même règle que le bloc sombre de l'écran Objectifs. */}
      {cells.length > 0 && (
        <>
          <DeckDensity cells={cells} color={skin.core} className="mt-7" />
          <DeckEyebrow className="mt-3">Évolution du trimestre</DeckEyebrow>
        </>
      )}

      <DeckAction
        onClick={onNext}
        className="mt-7"
      >
        {last ? 'Continuer →' : 'Objectif suivant →'}
      </DeckAction>
    </>
  )
}
