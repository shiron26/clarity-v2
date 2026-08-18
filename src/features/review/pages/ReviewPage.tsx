import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppToday } from '../../../hooks/useAppToday'
import {
  selectPrincipals,
  selectSecondaries,
  useObjectives,
} from '../../../hooks/useObjectives'
import { useEnsureReview } from '../../../hooks/useReviewMutations'
import { useRitualWeek } from '../../../hooks/useRitualWeek'
import { useReview, useWeekReviews, weekReviewKey, type Review } from '../../../hooks/useReview'
import { openingKey, useReviewOpenings } from '../../../hooks/useReviewOpenings'
import { useQueriesState } from '../../../hooks/useQueriesState'
import { anyLoading } from '../../../lib/queryLoading'
import { useAuth } from '../../auth/useAuth'
import { objectivesForQuarter, objectivesForWeek } from '../../../lib/reviewPeriod'
import {
  isoWeek,
  quarterAnchor,
  quarterOf,
  weeksOfQuarterRefs,
  year as yearOf,
  type IsoDate,
  type WeekRef,
} from '../../../lib/appDate'
import { ErrorState } from '../../../components/ui/ErrorState'
import { dataErrorMessage } from '../../../lib/errorMessage'
import { PageError, PageLoading } from '../../../components/layout/PageState'
import { ReviewEmpty } from '../components/ReviewEmpty'
import { RitualHub } from '../components/RitualHub'
import { RitualFlow } from '../components/RitualFlow'
import { ritualBanner } from '../ritualContent'

/** Le rituel en cours de traversée — figé pour la durée de la séance. */
type ActiveRitual = { review: Review; start: IsoDate; weekNo: number }

/**
 * `/review` — le hub du rituel, et le rituel par-dessus.
 *
 * La page n'ouvre plus le flux toute seule. Elle montre d'abord où l'on en est
 * dans le trimestre : sans ça, une semaine sans rendez-vous à tenir affichait
 * une phrase seule au milieu du vide, alors que douze autres semaines avaient
 * quelque chose à raconter.
 *
 * La bannière ne choisit pas sa période : `useRitualWeek` la donne, et c'est la
 * même source que l'encart du dashboard. Les deux ne peuvent donc pas se
 * contredire. La grille, elle, ouvre n'importe quelle semaine déjà ouverte — un
 * rituel reste faisable après coup, « il n'est jamais une porte » (REFONTE §7).
 * « Rien ne s'empile » borne les **rappels**, pas l'accès.
 */
export function ReviewPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user.id

  const todayQuery = useAppToday()
  const today = todayQuery.data

  const currentYear = today ? yearOf(today) : undefined
  const currentQuarter = today ? quarterOf(today) : undefined
  const currentWeekRef = today ? isoWeek(today) : undefined

  const [pickedYear, setPickedYear] = useState<number>()
  const [pickedQuarter, setPickedQuarter] = useState<number>()
  const year = pickedYear ?? currentYear
  const quarter = pickedQuarter ?? currentQuarter

  /**
   * Le rituel ouvert, **verrouillé** une fois qu'il a commencé.
   *
   * Sans ce verrou, l'écran 4 se saborde : « Terminer » valide la session,
   * `useRitualWeek` cesse aussitôt de rendre un rituel en attente, et l'overlay
   * disparaît avant d'avoir montré la projection. Or c'est précisément l'écran
   * qui RETOURNE quelque chose — les trois autres demandent. On ne le laisse pas
   * dépendre d'un état serveur que le rituel lui-même vient de changer.
   */
  const [active, setActive] = useState<ActiveRitual | null>(null)

  const weeks = useMemo(
    () => (year && quarter ? weeksOfQuarterRefs(quarterAnchor(year, quarter)) : []),
    [year, quarter],
  )
  // Une grille de trimestre peut enjamber deux années ISO : la semaine du
  // 1er janvier appartient parfois encore à l'année précédente.
  const isoYears = useMemo(() => [...new Set(weeks.map((w) => w.isoYear))], [weeks])

  const openingsQuery = useReviewOpenings(year ? [...isoYears, year] : [])
  const weekReviewsQuery = useWeekReviews(isoYears)
  const quarterReviewQuery = useReview(
    year && quarter ? { type: 'quarter', year, index: quarter } : undefined,
  )

  const ritual = useRitualWeek()

  // La bannière porte le rendez-vous qui attend ; à défaut, la semaine en cours.
  // Hors du trimestre qui la contient, il n'y a rien à commencer depuis le haut
  // de page : la grille se suffit.
  const bannerWeek = useMemo((): WeekRef | null => {
    const target = ritual.pending
      ? { isoYear: ritual.pending.week.isoYear, weekNo: ritual.pending.week.isoWeek }
      : currentWeekRef
        ? { isoYear: currentWeekRef.isoYear, weekNo: currentWeekRef.isoWeek }
        : null
    if (!target) return null
    return (
      weeks.find((w) => w.isoYear === target.isoYear && w.weekNo === target.weekNo) ?? null
    )
  }, [ritual.pending, currentWeekRef, weeks])

  // Les objectifs se lisent sur l'année civile du lundi en jeu, pas sur celle du
  // sélecteur : une grille de premier trimestre mord sur décembre précédent.
  const objectiveYear = useMemo(() => {
    const anchorDay = active?.start ?? bannerWeek?.monday
    if (anchorDay) return yearOf(anchorDay)
    return year && quarter ? yearOf(quarterAnchor(year, quarter)) : undefined
  }, [active, bannerWeek, year, quarter])

  const objectivesQuery = useObjectives(objectiveYear)
  const principals = useMemo(
    () => selectPrincipals(objectivesQuery.data),
    [objectivesQuery.data],
  )

  /**
   * Les semaines de la grille qui ont quelque chose à passer en revue.
   *
   * Les ouvertures viennent du serveur et sont **globales** : il ne sait pas
   * depuis quand un compte existe, donc les treize semaines du trimestre
   * d'arrivée sont « ouvertes ». Sans ce comptage, cliquer une semaine antérieure
   * aux objectifs ouvrait un rituel sans sujet. Même fonction que la bannière,
   * pour que les deux ne puissent pas se contredire.
   */
  const reviewable = useMemo(
    () =>
      new Set(
        weeks
          .filter((w) => objectivesForWeek(principals, w.monday).length > 0)
          .map((w) => w.monday),
      ),
    [weeks, principals],
  )

  // Le bilan du trimestre juge les principaux ET les secondaires, comme
  // `BilanPage` : la pastille doit se taire exactement quand la page le ferait.
  const quarterHasSubjects = useMemo(() => {
    if (!year || !quarter) return false
    const subjects = [
      ...selectPrincipals(objectivesQuery.data),
      ...selectSecondaries(objectivesQuery.data),
    ]
    return objectivesForQuarter(subjects, year, quarter).length > 0
  }, [objectivesQuery.data, year, quarter])

  // Un objectif clôturé reste vu une dernière fois sur la période qu'il a vécue,
  // et un objectif trimestriel ne se montre que sur SA fenêtre.
  const activeObjectives = useMemo(
    () => (active ? objectivesForWeek(principals, active.start) : []),
    [principals, active],
  )

  const banner = useMemo(() => {
    if (!bannerWeek) return null
    const opening = openingsQuery.data?.get(
      openingKey('week', bannerWeek.isoYear, bannerWeek.weekNo),
    )
    const review = weekReviewsQuery.data?.get(
      weekReviewKey(bannerWeek.isoYear, bannerWeek.weekNo),
    )
    return ritualBanner({
      weekNo: bannerWeek.weekNo,
      currentWeekNo: currentWeekRef?.isoWeek,
      monday: bannerWeek.monday,
      objectiveCount: objectivesForWeek(principals, bannerWeek.monday).length,
      isOpen: opening?.isOpen ?? false,
      openAt: opening?.openAt,
      validatedAt: review?.validated_at ?? null,
    })
  }, [bannerWeek, openingsQuery.data, weekReviewsQuery.data, currentWeekRef, principals])

  // La session doit exister avant que l'overlay n'écrive quoi que ce soit :
  // `review.id` est la cible de la validation finale. `useEnsureReview` rend
  // celle qui existe déjà, donc rouvrir une semaine passée ne crée rien.
  const ensureReview = useEnsureReview()

  const openWeek = (week: WeekRef) => {
    if (!userId) return
    // La carte est déjà inerte dans ce cas ; ce garde-fou couvre la bannière et
    // tout futur appelant. Ouvrir un rituel sans sujet n'affiche rien.
    if (!reviewable.has(week.monday)) return
    ensureReview
      .mutateAsync({
        userId,
        period: { type: 'week', year: week.isoYear, index: week.weekNo },
      })
      .then((review) => setActive({ review, start: week.monday, weekNo: week.weekNo }))
      .catch(() => {
        // Affichée par `useQueriesState` via `ensureReview.error`.
      })
  }

  const queries = [
    todayQuery,
    objectivesQuery,
    openingsQuery,
    weekReviewsQuery,
    quarterReviewQuery,
  ]
  const { firstError, retrying, onRetry } = useQueriesState(
    queries,
    ensureReview.error ?? ritual.error,
  )

  // `anyLoading` et jamais `isPending` : `useObjectives` est désactivé sans année,
  // et une query désactivée reste « pending » à vie (voir `lib/queryLoading.ts`).
  if (anyLoading([todayQuery, objectivesQuery])) return <PageLoading />

  if (todayQuery.isError || !today || !year || !quarter || !currentYear) {
    return (
      <PageError
        title="Impossible d’ouvrir votre rituel"
        error={todayQuery.error ?? new Error('unavailable')}
        onRetry={onRetry}
        retrying={retrying}
      />
    )
  }

  // L'état vide dit « aucun objectif », pas « aucun objectif en 2024 » : le
  // borner à l'année en cours évite qu'un aller-retour dans le sélecteur fasse
  // disparaître le hub — et avec lui le sélecteur qui permettrait d'en revenir.
  if (principals.length === 0 && objectiveYear === currentYear) return <ReviewEmpty />

  const quarterOpening = openingsQuery.data?.get(openingKey('quarter', year, quarter))

  return (
    <div className="flex flex-col gap-4 lg:gap-4.5">
      {firstError && (
        <ErrorState
          description={dataErrorMessage(firstError)}
          onRetry={onRetry}
          retrying={retrying}
        />
      )}

      <RitualHub
        year={year}
        currentYear={currentYear}
        quarter={quarter}
        currentQuarter={currentQuarter}
        weeks={weeks}
        reviews={weekReviewsQuery.data}
        openings={openingsQuery.data}
        today={today}
        currentWeek={currentWeekRef}
        banner={banner}
        quarterOpenAt={quarterOpening?.openAt}
        quarterIsOpen={quarterOpening?.isOpen ?? false}
        quarterValidatedAt={quarterReviewQuery.data?.validated_at ?? null}
        quarterHasSubjects={quarterHasSubjects}
        reviewable={reviewable}
        onSelectYear={setPickedYear}
        onSelectQuarter={setPickedQuarter}
        onStartBanner={() => bannerWeek && openWeek(bannerWeek)}
        onOpenWeek={openWeek}
      />

      {active && (
        <RitualFlow
          review={active.review}
          weekStart={active.start}
          weekNo={active.weekNo}
          today={today}
          objectives={activeObjectives}
          onClose={() => setActive(null)}
          onFinish={() => void navigate('/')}
        />
      )}
    </div>
  )
}
