// La session de review d'une période, et les notes qu'elle porte.
//
// `public.review` est une vraie table en clair (aucune colonne chiffrée) : on la
// lit et on l'écrit directement. `public.review_item` est une vue déchiffrante
// sans métadonnée de clé étrangère (`Relationships: []`) : pas d'embedding
// PostgREST, on charge les items séparément.
//
// La ligne `review` n'existe qu'à partir du moment où l'utilisateur a lancé le
// rituel : `maybeSingle()`, et `undefined` est l'état normal d'une période
// jamais ouverte.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

/** Les trois niveaux partagent la même table ; seule la portée change (SPEC §4.4). */
export type PeriodType = 'week' | 'quarter' | 'year'

export type PeriodRef = {
  type: PeriodType
  year: number
  /** Semaine ISO, trimestre 1–4, ou `null` pour le bilan annuel. */
  index: number | null
}

export type Review = {
  id: string
  period_type: string
  period_year: number
  period_index: number | null
  validated_at: string | null
  created_by: string
}

export type ReviewItem = {
  id: string
  objective_id: string
  rating: number | null
  /**
   * Le verdict — « atteint » / « pas atteint ». Exclusif de `rating` sur une même
   * ligne : au bilan de trimestre, un objectif dont la fenêtre se ferme se conclut,
   * un objectif qui continue se note (REFONTE §8).
   */
  achieved: boolean | null
  comment: string | null
}

export function useReview(period: PeriodRef | undefined) {
  const { status, session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: queryKeys.review.byPeriod(
      period?.type ?? '',
      period?.year ?? 0,
      period?.index ?? null,
    ),
    enabled: status === 'signedIn' && !!userId && !!period,
    queryFn: async (): Promise<Review | null> => {
      let query = supabase
        .from('review')
        .select('id, period_type, period_year, period_index, validated_at, created_by')
        .eq('user_id', userId!)
        .eq('period_type', period!.type)
        .eq('period_year', period!.year)

      // `is('period_index', null)` et `eq(…, null)` ne sont pas interchangeables
      // en PostgREST : le bilan annuel se filtre sur `is null`.
      query = period!.index === null
        ? query.is('period_index', null)
        : query.eq('period_index', period!.index)

      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * Les quatre bilans de trimestre d'une année, indexés par numéro.
 *
 * L'écran Année liste les quatre trimestres et l'état de chacun : quatre
 * `useReview` feraient quatre allers-retours pour quatre lignes au plus.
 * `undefined` reste l'état normal d'un trimestre jamais ouvert.
 */
export function useQuarterReviews(year: number | undefined) {
  const { status, session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: queryKeys.review.quarters(year ?? 0),
    enabled: status === 'signedIn' && !!userId && !!year,
    queryFn: async (): Promise<Map<number, Review>> => {
      const { data, error } = await supabase
        .from('review')
        .select('id, period_type, period_year, period_index, validated_at, created_by')
        .eq('user_id', userId!)
        .eq('period_type', 'quarter')
        .eq('period_year', year!)
      if (error) throw error

      const byQuarter = new Map<number, Review>()
      for (const row of data ?? []) {
        if (row.period_index !== null) byQuarter.set(row.period_index, row)
      }
      return byQuarter
    },
  })
}

/**
 * Les sessions **hebdomadaires** d'une ou deux années ISO, indexées par période.
 *
 * Le hub du rituel affiche treize cartes et n'a besoin, pour chacune, que de
 * savoir si sa session a été validée : treize `useReview` feraient treize
 * allers-retours pour treize lignes au plus. Le tableau d'années est là parce
 * qu'une grille de trimestre peut enjamber deux années ISO — la clé est donc le
 * couple (année, semaine), jamais le numéro seul.
 */
export function weekReviewKey(isoYear: number, weekNo: number): string {
  return `${isoYear}|${weekNo}`
}

export function useWeekReviews(isoYears: number[]) {
  const { status, session } = useAuth()
  const userId = session?.user.id
  const years = [...new Set(isoYears)].sort()

  return useQuery({
    queryKey: queryKeys.review.weeks(years),
    enabled: status === 'signedIn' && !!userId && years.length > 0,
    queryFn: async (): Promise<Map<string, Review>> => {
      const { data, error } = await supabase
        .from('review')
        .select('id, period_type, period_year, period_index, validated_at, created_by')
        .eq('user_id', userId!)
        .eq('period_type', 'week')
        .in('period_year', years)
      if (error) throw error

      const byWeek = new Map<string, Review>()
      for (const row of data ?? []) {
        if (row.period_index !== null) {
          byWeek.set(weekReviewKey(row.period_year, row.period_index), row)
        }
      }
      return byWeek
    },
  })
}

/** Les notes d'une session, indexées par objectif. */
export function useReviewItems(reviewId: string | undefined) {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.review.items(reviewId ?? ''),
    enabled: status === 'signedIn' && !!reviewId,
    queryFn: async (): Promise<Map<string, ReviewItem>> => {
      const { data, error } = await supabase
        .from('review_item')
        .select('id, objective_id, rating, achieved, comment')
        .eq('review_id', reviewId!)
      if (error) throw error

      const items = new Map<string, ReviewItem>()
      for (const row of data ?? []) {
        if (!row.id || !row.objective_id) continue
        items.set(row.objective_id, {
          id: row.id,
          objective_id: row.objective_id,
          rating: row.rating,
          achieved: row.achieved,
          comment: row.comment,
        })
      }
      return items
    },
  })
}
