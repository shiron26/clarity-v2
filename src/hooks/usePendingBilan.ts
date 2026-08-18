// Quel bilan attend — et il n'y en a jamais plus d'un.
//
// Même doctrine que `useRitualWeek` : deux écrans posent la question (l'encart du
// dashboard et la page qui l'ouvre), une seule réponse, sinon l'encart annonce un
// bilan et en ouvre un autre. **Rien ne s'empile** non plus : sauter le bilan de
// T2 ne le fait pas revenir à côté de celui de T3, seul le plus récent attend.
//
// Le trimestre et l'année sont **deux cérémonies distinctes** (SPEC §4.4 : le
// dernier vendredi de décembre les porte séparément). Le soir où les deux
// s'ouvrent, on présente le trimestre d'abord ; l'année prend sa place une fois le
// trimestre validé. C'est ce qui tient « une seule assise » sans fusionner les
// deux flux.
//
// Et comme pour le rituel, la **borne d'arrivée** se pose ici : `review_openings`
// ouvre une période pour tout le monde en même temps, le serveur ne sachant pas
// depuis quand un compte existe. Sans elle, s'inscrire le 30 décembre proposait le
// bilan de T4 dans la seconde, puis celui des douze mois de l'année.
import { useAppToday } from './useAppToday'
import { useProfile } from './useProfile'
import { useQuarterReviews, useReview, type Review } from './useReview'
import { addDays, quarterOf, year as yearOf, type IsoDate } from '../lib/appDate'
import { windowEnd } from '../lib/objectiveFeasibility'
import { openingKey, useReviewOpenings } from './useReviewOpenings'
import type { BilanPeriod } from '../lib/quarterLabels'

export type PendingBilan = {
  year: number
  period: BilanPeriod
  /** La session, si elle a déjà été ouverte. `undefined` avant le premier clic. */
  review: Review | undefined
}

export type PendingBilanState = {
  /** Le bilan à faire, ou `null` s'il n'y en a aucun d'ouvert et non validé. */
  pending: PendingBilan | null
  isPending: boolean
  error: Error | null
}

export function usePendingBilan(): PendingBilanState {
  const todayQuery = useAppToday()
  const today = todayQuery.data
  const profileQuery = useProfile()

  const year = today ? yearOf(today) : undefined
  const quarter = today ? quarterOf(today) : undefined

  const openingsQuery = useReviewOpenings(year ? [year] : [])
  const quarterReviewsQuery = useQuarterReviews(year)
  const yearReviewQuery = useReview(year ? { type: 'year', year, index: null } : undefined)

  const openings = openingsQuery.data
  const quarterOpening =
    year && quarter ? openings?.get(openingKey('quarter', year, quarter)) : undefined
  const yearOpening = year ? openings?.get(openingKey('year', year, null)) : undefined

  const quarterReview = quarter ? quarterReviewsQuery.data?.get(quarter) : undefined
  const yearReview = yearReviewQuery.data ?? undefined

  /**
   * La période a-t-elle été vécue par le compte ?
   *
   * Même règle et même seuil que `useRitualWeek` : `onboarded_at` (la seule marque
   * d'arrivée lisible côté client, `public.profile` n'ayant pas de `created_at`)
   * comparé au DERNIER JOUR de la période, comme `objectivesForQuarter`. Arriver
   * le 20 décembre laisse donc le bilan de T4 ; arriver le 2 janvier ne le
   * ressuscite pas. `onboarded_at` nulle = bienvenue non terminée, donc rien à
   * conclure.
   */
  const arrivedOn = profileQuery.data?.onboarded_at?.slice(0, 10)
  const livedThrough = (lastDay: IsoDate) => arrivedOn !== undefined && arrivedOn <= lastDay

  const quarterLived =
    year !== undefined && quarter !== undefined && livedThrough(addDays(windowEnd(year, quarter), -1))
  const yearLived = year !== undefined && livedThrough(`${year}-12-31` as IsoDate)

  // Le trimestre d'abord, l'année ensuite — et seulement si sa cérémonie n'a pas
  // déjà eu lieu. Une review validée ne se represente pas : c'est ce qui fait
  // disparaître l'encart du dashboard une fois la séance faite.
  const pending: PendingBilan | null =
    year && quarter && quarterLived && quarterOpening?.isOpen && quarterReview?.validated_at == null
      ? { year, period: { type: 'quarter', quarter }, review: quarterReview }
      : year && yearLived && yearOpening?.isOpen && yearReview?.validated_at == null
        ? { year, period: { type: 'year' }, review: yearReview }
        : null

  return {
    pending,
    isPending: todayQuery.isPending || profileQuery.isPending || openingsQuery.isPending,
    error:
      todayQuery.error ??
      profileQuery.error ??
      openingsQuery.error ??
      quarterReviewsQuery.error ??
      yearReviewQuery.error ??
      null,
  }
}
