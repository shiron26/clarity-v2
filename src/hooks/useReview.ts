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

/** Les notes d'une session, indexées par objectif. */
export function useReviewItems(reviewId: string | undefined) {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.review.items(reviewId ?? ''),
    enabled: status === 'signedIn' && !!reviewId,
    queryFn: async (): Promise<Map<string, ReviewItem>> => {
      const { data, error } = await supabase
        .from('review_item')
        .select('id, objective_id, rating, comment')
        .eq('review_id', reviewId!)
      if (error) throw error

      const items = new Map<string, ReviewItem>()
      for (const row of data ?? []) {
        if (!row.id || !row.objective_id) continue
        items.set(row.objective_id, {
          id: row.id,
          objective_id: row.objective_id,
          rating: row.rating,
          comment: row.comment,
        })
      }
      return items
    },
  })
}
