import { useMemo, useState } from 'react'
import { RitualOverlay } from '../../../components/ritual/RitualOverlay'
import { DeckCard } from '../../../components/ritual/DeckCard'
import { DeckHeading } from '../../../components/ritual/DeckHeading'
import { Alert } from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Spinner'
import { CommentField } from './CommentField'
import { VerdictChoice } from './VerdictChoice'
import { YearBilanRecap } from './YearBilanRecap'
import { defaultVerdict, yearRecap } from '../yearBilanContent'
import { useObjectiveActiveDays } from '../../../hooks/useObjectiveActiveDays'
import { useObjectivePeriodsForYear } from '../../../hooks/useObjectivePeriods'
import { useReviewItems } from '../../../hooks/useReview'
import { useReviewItemWriter, useValidateReview } from '../../../hooks/useReviewMutations'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { objectiveSkinOf, SECONDARY_SKIN } from '../../../lib/objectivePalette'
import { anyLoading } from '../../../lib/queryLoading'
import { buildYearTracks } from '../../../lib/yearTimeline'
import type { IsoDate } from '../../../lib/appDate'
import type { Objective } from '../../../hooks/useObjectives'
import type { Review } from '../../../hooks/useReview'
import { DeckAction } from '../../../components/ritual/DeckAction'

/** Le récit, les verdicts des principaux, ceux des secondaires. */
const STEPS = ['recap', 'principals', 'secondaries'] as const
type Step = (typeof STEPS)[number]

type YearBilanFlowProps = {
  review: Review
  year: number
  today: IsoDate | null
  principals: Objective[]
  secondaries: Objective[]
  onClose: () => void
}

/**
 * Le bilan de l'année — **une cérémonie à part**, pas la fin de celle de T4.
 *
 * Le dernier vendredi de décembre ouvre les deux (SPEC §4.4), et elles restent
 * séparées : le trimestre recompose les trois places pour les trois mois qui
 * viennent, l'année ferme douze mois. Les mélanger ferait porter à un même écran
 * deux questions qui n'ont pas le même horizon.
 *
 * Ici **aucune note** : au niveau `year`, la base n'accepte que le verdict
 * (`review_item_rating_not_for_year`). Un an ne se juge pas au rythme, il se
 * conclut. Et le bilan reste remplissable après le 1er janvier, alors même que
 * les objectifs sont archivés — l'archivage gèle l'objet, pas le jugement.
 */
export function YearBilanFlow({
  review,
  year,
  today,
  principals,
  secondaries,
  onClose,
}: YearBilanFlowProps) {
  const [step, setStep] = useState(0)
  const [goalIndex, setGoalIndex] = useState(0)

  const subjects = useMemo(
    () => [...principals, ...secondaries],
    [principals, secondaries],
  )
  const objectiveIds = useMemo(() => subjects.map((o) => o.id), [subjects])

  const { periods, queries: periodQueries } = useObjectivePeriodsForYear(subjects, year)
  const activeDaysQuery = useObjectiveActiveDays(
    objectiveIds,
    `${year}-01-01`,
    `${year}-12-31`,
  )
  const itemsQuery = useReviewItems(review.id)

  const validateReview = useValidateReview()
  const items = itemsQuery.data
  const writer = useReviewItemWriter(review.id, items)

  const recap = useMemo(
    () =>
      yearRecap({
        objectives: subjects,
        periods,
        activeDays: activeDaysQuery.data ?? new Set<string>(),
        items,
      }),
    [subjects, periods, activeDaysQuery.data, items],
  )

  const tracks = useMemo(
    () => buildYearTracks({ objectives: subjects, periods, year, today }),
    [subjects, periods, year, today],
  )

  // Adaptateurs : les decks manipulent des objectifs, le writer des identifiants.
  function verdict(objective: Objective, achieved: boolean) {
    writer.verdict(objective.id, achieved)
  }

  function comment(objective: Objective, text: string | null) {
    writer.comment(objective.id, text)
  }

  /**
   * Terminer, c'est écrire. Tant que la validation n'a pas abouti, la cérémonie
   * ne se déclare pas terminée : sinon un échec (réseau coupé, session expirée)
   * laissait `validated_at` nul, l'encart revenait à la visite suivante, et on
   * refaisait le même rituel sans jamais voir pourquoi. `validateReview.error`
   * est affichée par l'`Alert` du deck, d'où le `catch` muet.
   */
  function handleFinish() {
    if (review.validated_at !== null) {
      onClose()
      return
    }
    validateReview
      .mutateAsync(review.id)
      .then(onClose)
      .catch(() => {})
  }

  // Sans secondaire, la dernière question n'a personne à qui s'adresser.
  const visible = useMemo(
    () => STEPS.filter((s) => s !== 'secondaries' || secondaries.length > 0),
    [secondaries.length],
  )
  const current: Step = visible[Math.min(step, visible.length - 1)]!
  const last = step === visible.length - 1

  const loading = anyLoading([...periodQueries, activeDaysQuery, itemsQuery])
  const writeError = writer.error ?? validateReview.error ?? null
  const objective = principals[goalIndex]

  return (
    <RitualOverlay
      label={`Bilan de l’année ${year}`}
      step={step + 1}
      total={visible.length}
      onClose={onClose}
    >
      {writeError && (
        <Alert variant="danger" className="mb-4 w-full text-left">
          {dataErrorMessage(writeError)}
        </Alert>
      )}

      {loading ? (
        <Spinner className="text-ink-onnight" />
      ) : current === 'recap' ? (
        <YearBilanRecap
          year={year}
          recap={recap}
          tracks={tracks}
          onNext={() => setStep(step + 1)}
        />
      ) : current === 'principals' && objective ? (
        <>
          <DeckHeading eyebrow={`Objectif ${goalIndex + 1} / ${principals.length} · principal`}>
            {objective.title}
          </DeckHeading>

          <div aria-hidden className="mt-4 flex justify-center gap-1.5">
            {principals.map((o, i) => (
              <span
                key={o.id}
                className={i > goalIndex ? 'size-2.5 rounded-full bg-deck-idle' : 'size-2.5 rounded-full'}
                style={
                  i <= goalIndex ? { backgroundColor: objectiveSkinOf(objective).core } : undefined
                }
              />
            ))}
          </div>

          <VerdictChoice
            value={defaultVerdict(objective, items?.get(objective.id))}
            onChange={(achieved) => verdict(objective, achieved)}
            label={`Verdict de l’année — ${objective.title}`}
          />

          <CommentField
            value={items?.get(objective.id)?.comment ?? ''}
            onCommit={(text) => comment(objective, text)}
            placeholder="Ce que vous en retenez…"
            label={`Notes sur « ${objective.title} »`}
          />

          <DeckAction
            onClick={() => {
              if (goalIndex < principals.length - 1) setGoalIndex(goalIndex + 1)
              else if (last) handleFinish()
              else setStep(step + 1)
            }}
            className="mt-7"
          >
            {goalIndex < principals.length - 1 ? 'Objectif suivant →' : 'Continuer →'}
          </DeckAction>
        </>
      ) : (
        <>
          <DeckHeading
            eyebrow={`Secondaires · ${secondaries.length}`}
            subtitle="Un verdict suffit."
          >
            Et vos objectifs de second plan&nbsp;?
          </DeckHeading>

          <div className="mt-6.5 flex w-full flex-col gap-2.5">
            {secondaries.map((secondary, index) => (
              <DeckCard key={secondary.id} index={index}>
                <div className="mb-3 flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: SECONDARY_SKIN.hue }}
                  />
                  <span className="truncate text-body text-ink-onnight-strong">
                    {secondary.title}
                  </span>
                </div>
                <VerdictChoice
                  value={defaultVerdict(secondary, items?.get(secondary.id))}
                  onChange={(achieved) => verdict(secondary, achieved)}
                  label={`Verdict de l’année — ${secondary.title}`}
                  size="compact"
                />
              </DeckCard>
            ))}
          </div>

          <DeckAction
            onClick={handleFinish}
            className="mt-6.5"
          >
            Terminer le bilan →
          </DeckAction>
        </>
      )}
    </RitualOverlay>
  )
}
