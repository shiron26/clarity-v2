// Quel rituel attend — et il n'y en a jamais plus d'un.
//
// Deux écrans posent la même question et doivent recevoir la même réponse :
// l'encart du dashboard (« Commencer mon rituel ») et la page qui l'ouvre. Les
// laisser dériver chacun de leur côté ferait apparaître un encart qui mène à un
// autre rituel que celui qu'il annonce.
//
// Un rituel n'ouvre que le vendredi soir (public.review_openings) : du lundi au
// jeudi, celui qui attend est celui de la semaine écoulée, et il reste faisable
// après coup — « le rituel n'est jamais une porte » (REFONTE §7). On ne remonte
// pas plus loin : sauter trois semaines ne produit pas trois rappels, seulement
// le plus récent. **Rien ne s'empile.**
//
// `review_openings` ouvre une semaine pour tout le monde en même temps : le
// serveur ne sait pas depuis quand un compte existe. C'est donc ici que se pose
// la borne d'arrivée, sans quoi quelqu'un qui s'inscrit un mardi se voit proposer
// le rituel de la semaine d'avant.
import { useAppToday } from './useAppToday'
import { useProfile } from './useProfile'
import { useReview, type Review } from './useReview'
import { openingKey, useReviewOpenings } from './useReviewOpenings'
import { addDays, isoWeek, startOfWeek, type IsoDate, type IsoWeek } from '../lib/appDate'
import type { QueryLike } from './useQueriesState'

export type RitualWeek = {
  week: IsoWeek
  /** Lundi de la semaine passée en revue — l'ancre de tous les faits affichés. */
  start: IsoDate
  /** La session, si elle a déjà été ouverte. `undefined` avant le premier clic. */
  review: Review | undefined
}

export type RitualState = {
  /** Le rituel à faire, ou `null` s'il n'y en a aucun d'ouvert et non validé. */
  pending: RitualWeek | null
  /** Ouverture du prochain rituel — ce qu'on affiche quand `pending` est null. */
  nextOpenAt: string | undefined
  /**
   * La semaine précédente et sa session, validée ou non. Sa donnée est déjà
   * chargée pour départager le candidat : l'exposer ne coûte pas une query de
   * plus, et l'encart peut dire « semaine du 10 août : notée ».
   */
  previous: RitualWeek | null
  isPending: boolean
  /**
   * Les queries, et pas seulement leur première erreur. Un `Error` seul n'est pas
   * retentable : l'écran qui l'affiche n'a plus rien à relancer, et son bouton
   * « Réessayer » tourne sur une liste vide (voir `useQueriesState`).
   */
  queries: QueryLike[]
}

export function useRitualWeek(): RitualState {
  const todayQuery = useAppToday()
  const today = todayQuery.data
  const profileQuery = useProfile()

  const weekStart = today ? startOfWeek(today) : undefined
  const current = today ? isoWeek(today) : undefined
  const previous = weekStart ? isoWeek(addDays(weekStart, -7)) : undefined

  const openingsQuery = useReviewOpenings(
    current && previous ? [current.isoYear, previous.isoYear] : [],
  )
  const currentReviewQuery = useReview(
    current ? { type: 'week', year: current.isoYear, index: current.isoWeek } : undefined,
  )
  const previousReviewQuery = useReview(
    previous ? { type: 'week', year: previous.isoYear, index: previous.isoWeek } : undefined,
  )

  const openings = openingsQuery.data
  const currentOpening = current
    ? openings?.get(openingKey('week', current.isoYear, current.isoWeek))
    : undefined
  const previousOpening = previous
    ? openings?.get(openingKey('week', previous.isoYear, previous.isoWeek))
    : undefined

  // La semaine en cours dès qu'elle est ouverte, sinon celle qui vient de
  // s'achever. L'ordre compte : dimanche soir, les deux sont ouvertes.
  const candidate: RitualWeek | null =
    currentOpening?.isOpen && current && weekStart
      ? { week: current, start: weekStart, review: currentReviewQuery.data ?? undefined }
      : previousOpening?.isOpen && previous && weekStart
        ? {
            week: previous,
            start: addDays(weekStart, -7),
            review: previousReviewQuery.data ?? undefined,
          }
        : null

  // La semaine doit avoir été vécue par le compte : `onboarded_at` est la seule
  // marque d'arrivée lisible côté client (`public.profile` n'a pas de
  // `created_at`, et `auth.users` n'est pas exposée). Le seuil est la fin de la
  // semaine, comme pour les objectifs (`objectivesForWeek`) : s'inscrire le
  // samedi laisse le rituel du dimanche soir. `onboarded_at` nulle = parcours de
  // bienvenue non terminé, donc rien à passer en revue.
  const arrivedOn = profileQuery.data?.onboarded_at?.slice(0, 10)
  const lived =
    candidate !== null && arrivedOn !== undefined && arrivedOn <= addDays(candidate.start, 6)

  // Un rituel validé ne se represente pas : c'est ce qui fait disparaître
  // l'encart du dashboard une fois la séance faite.
  const pending = lived && candidate?.review?.validated_at == null ? candidate : null

  return {
    pending,
    // La semaine en cours n'est pas encore ouverte → c'est elle qu'on annonce.
    nextOpenAt: currentOpening?.isOpen ? undefined : currentOpening?.openAt,
    previous:
      previous && weekStart
        ? {
            week: previous,
            start: addDays(weekStart, -7),
            review: previousReviewQuery.data ?? undefined,
          }
        : null,
    isPending: todayQuery.isPending || openingsQuery.isPending || profileQuery.isPending,
    queries: [
      todayQuery,
      openingsQuery,
      profileQuery,
      currentReviewQuery,
      previousReviewQuery,
    ],
  }
}
