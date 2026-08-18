import { useMemo, useState } from 'react'
import { RitualOverlay } from '../../../components/ritual/RitualOverlay'
import { DeckRecap } from '../../../components/ritual/DeckRecap'
import { Alert } from '../../../components/ui/Alert'
import { Spinner } from '../../../components/ui/Spinner'
import { ObjectiveWizardModal } from '../../../components/objectives/ObjectiveWizardModal'
import { BilanNext, type NextChoice } from './BilanNext'
import { BilanSecondaries, type SecondaryLine } from './BilanSecondaries'
import { BilanVerdict } from './BilanVerdict'
import { bilanEyebrow, bilanRecap, verdictExpected, verdictReason } from '../bilanContent'
import { useMilestones } from '../../../hooks/useMilestones'
import { useCreateMilestone } from '../../../hooks/useMilestoneMutations'
import { useObjectiveEntriesRange } from '../../../hooks/useObjectiveEntries'
import { useObjectivePeriodsFor } from '../../../hooks/useObjectivePeriods'
import { MAX_SECONDARIES } from '../../../hooks/useObjectives'
import { useReviewItems } from '../../../hooks/useReview'
import { useReviewItemWriter, useValidateReview } from '../../../hooks/useReviewMutations'
import { quarterAnchor, weeksOfQuarterRefs, type IsoDate } from '../../../lib/appDate'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { emptyDraft, draftFromObjective } from '../../../lib/objectiveDraft'
import { periodYearFor } from '../../../lib/objectivePeriod'
import { anyLoading } from '../../../lib/queryLoading'
import { windowEnd } from '../../../lib/objectiveFeasibility'
import { buildQuarterRows } from '../../../lib/quarterTimeline'
import { buildQuarterStats, buildQuarterTotals } from '../../../lib/quarterStats'
import type { Rating } from '../../../lib/reviewRating'
import type { Objective } from '../../../hooks/useObjectives'
import type { Review } from '../../../hooks/useReview'

/** Le constat, les deux verdicts, puis l'acte. */
const STEPS = ['recap', 'principals', 'secondaries', 'next'] as const
type Step = (typeof STEPS)[number]

type BilanFlowProps = {
  review: Review
  userId: string
  year: number
  quarter: number
  /** Le jour applicatif, ou `null` sur un trimestre déjà révolu. */
  today: IsoDate | null
  principals: Objective[]
  secondaries: Objective[]
  /** Les arrêtés de l'année, candidats à une reprise au trimestre suivant. */
  stopped: Objective[]
  onClose: () => void
}

/**
 * Le bilan de trimestre, en plein écran.
 *
 * Même patron que `RitualFlow`, qui était déjà le bon : un tableau d'étapes, un
 * index en state local, aucune bibliothèque de machine à états, aucune route. Le
 * fetching vit ici et les decks sont muets — ils reçoivent des données déjà
 * formées et rendent des gestes.
 *
 * Ce que le rituel hebdo ne peut pas faire et que celui-ci fait : **conclure** un
 * objectif dont la fenêtre se ferme, et **recomposer** les trois places.
 */
export function BilanFlow({
  review,
  userId,
  year,
  quarter,
  today,
  principals,
  secondaries,
  stopped,
  onClose,
}: BilanFlowProps) {
  const [step, setStep] = useState(0)
  const [goalIndex, setGoalIndex] = useState(0)
  const [choice, setChoice] = useState<NextChoice | null>(null)
  const [wizard, setWizard] = useState<NextChoice | null>(null)

  const subjects = useMemo(
    () => [...principals, ...secondaries],
    [principals, secondaries],
  )
  const objectiveIds = useMemo(() => subjects.map((o) => o.id), [subjects])

  // Une grille de trimestre peut enjamber deux années ISO : ce sont ses semaines
  // qui disent lesquelles.
  const weeks = useMemo(() => weeksOfQuarterRefs(quarterAnchor(year, quarter)), [year, quarter])
  const weekYears = useMemo(() => [...new Set(weeks.map((w) => w.isoYear))], [weeks])

  const { periods, queries: periodQueries } = useObjectivePeriodsFor(
    subjects,
    weekYears,
    periodYearFor('month', quarterAnchor(year, quarter)),
  )
  const entriesQuery = useObjectiveEntriesRange(objectiveIds, `${year}-01-01`, `${year}-12-31`)
  const milestonesQuery = useMilestones(objectiveIds, year, quarter)
  // Les étapes déjà posées sur le trimestre à venir : le cap de 4 s'y compte,
  // pas sur celui qu'on conclut.
  const nextQuarter = quarter === 4 ? 1 : quarter + 1
  const nextYear = quarter === 4 ? year + 1 : year
  const nextMilestonesQuery = useMilestones(objectiveIds, nextYear, nextQuarter)
  const itemsQuery = useReviewItems(review.id)

  const createMilestone = useCreateMilestone()
  const validateReview = useValidateReview()

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])
  const milestones = useMemo(() => milestonesQuery.data ?? [], [milestonesQuery.data])
  const items = useMemo(() => itemsQuery.data, [itemsQuery.data])
  const writer = useReviewItemWriter(review.id, items)

  // Le chiffre et la sous-ligne de chaque objectif — **exactement ceux de la page
  // du trimestre**. La cérémonie et l'archive doivent dire la même chose : deux
  // formulations du même fait feraient douter des deux.
  const stats = useMemo(
    () =>
      new Map(
        buildQuarterStats({
          objectives: subjects,
          periods,
          entries,
          milestones,
          weeks,
          year,
          quarter,
          today,
        }).map((stat) => [stat.objective.id, stat]),
      ),
    [subjects, periods, entries, milestones, weeks, year, quarter, today],
  )

  const cellsByObjective = useMemo(
    () =>
      new Map(
        buildQuarterRows({ objectives: subjects, periods, weeks, year, quarter, today }).map(
          (row) => [row.objective.id, row.cells],
        ),
      ),
    [subjects, periods, weeks, year, quarter, today],
  )

  const recap = useMemo(
    () =>
      bilanRecap(
        buildQuarterTotals({ objectives: subjects, periods, entries, milestones, year, quarter }),
        weeks.length,
      ),
    [subjects, periods, entries, milestones, year, quarter, weeks.length],
  )

  const secondaryLines: SecondaryLine[] = useMemo(
    () =>
      secondaries.map((objective) => ({
        objective,
        item: items?.get(objective.id),
        value: stats.get(objective.id)?.value ?? '—',
        verdict: verdictExpected(objective, year, quarter),
        reason: verdictReason(objective, year, quarter),
      })),
    [secondaries, items, stats, year, quarter],
  )

  // Ceux qui poursuivent au trimestre suivant, et ceux qui se ferment ce soir.
  const carried = useMemo(
    () => principals.filter((o) => !verdictExpected(o, year, quarter)),
    [principals, year, quarter],
  )
  const closing = useMemo(
    () => principals.filter((o) => verdictExpected(o, year, quarter)),
    [principals, year, quarter],
  )

  // Un arrêté ne se reprend que si sa fenêtre est derrière nous : proposer de
  // « reprendre » un objectif encore en cours n'aurait aucun sens.
  const resumable = useMemo(
    () =>
      stopped
        .filter((o) => windowEnd(o.year, o.quarter) <= windowEnd(year, quarter))
        .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''))
        .at(0),
    [stopped, year, quarter],
  )

  // Les jalonnés qui continuent : eux seuls ont des étapes à poser pour la suite.
  const milestoneTargets = useMemo(
    () =>
      [...carried, ...secondaries.filter((o) => !verdictExpected(o, year, quarter))]
        .filter((o) => o.measure === 'jalons')
        .map((objective) => ({
          objective,
          count: (nextMilestonesQuery.data ?? []).filter(
            (m) => m.objective_id === objective.id,
          ).length,
        })),
    [carried, secondaries, year, quarter, nextMilestonesQuery.data],
  )

  // Un écran sans matière ne se traverse pas : sans secondaire, la question « et
  // vos objectifs de second plan ? » n'a personne à qui s'adresser.
  const visible = useMemo(
    () => STEPS.filter((s) => s !== 'secondaries' || secondaries.length > 0),
    [secondaries.length],
  )
  const current: Step = visible[Math.min(step, visible.length - 1)]!

  // Adaptateurs : les decks manipulent des objectifs, le writer des identifiants.
  function rate(objective: Objective, rating: Rating) {
    writer.rate(objective.id, rating)
  }

  function verdict(objective: Objective, achieved: boolean) {
    writer.verdict(objective.id, achieved)
  }

  function comment(objective: Objective, text: string | null) {
    writer.comment(objective.id, text)
  }

  function handleChoose(next: NextChoice) {
    setChoice(next)
    // « Laisser la place vide » n'ouvre rien : c'est une décision qui n'écrit pas.
    if (next !== 'leave') setWizard(next)
  }

  // « Validé » signifie « le bilan a eu lieu » : avoir traversé les écrans
  // suffit, on n'exige pas que tout ait été tranché (SPEC §4.4).
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

  const writeError = writer.error ?? createMilestone.error ?? validateReview.error ?? null

  const loading = anyLoading([
    ...periodQueries,
    entriesQuery,
    milestonesQuery,
    itemsQuery,
  ])

  const objective = principals[goalIndex]
  const stat = objective ? stats.get(objective.id) : undefined

  // La draft du wizard : le trimestre à venir est déjà répondu, et une reprise
  // recopie ce que l'objectif arrêté avait déclaré. On préremplit, on ne saute
  // aucune question.
  const initialDraft = useMemo(() => {
    if (wizard === 'resume' && resumable) {
      return { ...draftFromObjective(resumable), quarter: nextQuarter }
    }
    return { ...emptyDraft('principal'), quarter: nextQuarter }
  }, [wizard, resumable, nextQuarter])

  return (
    <>
      <RitualOverlay
        label={`Bilan du trimestre ${quarter}`}
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
          <DeckRecap
            eyebrow={bilanEyebrow(quarter)}
            count={recap.count}
            headline={recap.headline}
            detail={recap.detail}
            nextLabel="Continuer →"
            onNext={() => setStep(step + 1)}
          />
        ) : current === 'principals' && objective ? (
          <BilanVerdict
            key={objective.id}
            objective={objective}
            index={goalIndex}
            total={principals.length}
            item={items?.get(objective.id)}
            value={stat?.value ?? '—'}
            detail={stat?.detail ?? ''}
            cells={cellsByObjective.get(objective.id) ?? []}
            verdict={verdictExpected(objective, year, quarter)}
            reason={verdictReason(objective, year, quarter)}
            onRate={(rating) => rate(objective, rating)}
            onVerdict={(achieved) => verdict(objective, achieved)}
            onComment={(text) => comment(objective, text)}
            onNext={() => {
              if (goalIndex < principals.length - 1) setGoalIndex(goalIndex + 1)
              else setStep(step + 1)
            }}
          />
        ) : current === 'secondaries' ? (
          <BilanSecondaries
            lines={secondaryLines}
            onRate={rate}
            onVerdict={verdict}
            onNext={() => setStep(step + 1)}
          />
        ) : (
          <BilanNext
            year={nextYear}
            quarter={nextQuarter}
            carried={carried}
            closing={closing}
            stopped={resumable}
            choice={choice}
            onChoose={handleChoose}
            milestoneTargets={milestoneTargets}
            onAddMilestone={(target, title) =>
              createMilestone.mutate({
                objectiveId: target.id,
                year: nextYear,
                quarter: nextQuarter,
                title,
                position:
                  milestoneTargets.find((t) => t.objective.id === target.id)?.count ?? 0,
              })
            }
            onFinish={handleFinish}
          />
        )}
      </RitualOverlay>

      {/* Par-dessus le deck (`elevation`), pas derrière : la cérémonie occupe
          déjà `z-60`. Le wizard est partagé avec l'écran Objectifs — d'où sa
          place dans `src/components/`, une feature n'important jamais d'une
          autre (AGENTS.md). */}
      <ObjectiveWizardModal
        open={wizard !== null}
        onClose={() => setWizard(null)}
        userId={userId}
        year={nextYear}
        principalSlotsUsed={carried.length}
        secondarySlotsUsed={Math.min(secondaries.length, MAX_SECONDARIES)}
        initialDraft={initialDraft}
        elevation="ceremony"
        onCreated={() => setWizard(null)}
      />
    </>
  )
}
