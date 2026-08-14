// Toutes les notes hebdomadaires d'un trimestre, tous objectifs confondus : les
// fusées de chaque carte de la grille des semaines du hub.
//
// Généralisation multi-objectifs de `useObjectiveRatings`, qui répond à la même
// question pour un seul objectif (la sparkline de l'écran Objectifs). Deux
// requêtes jointes en mémoire, jamais d'embedding : `review_item` est une vue et
// n'expose aucune métadonnée de clé étrangère.
//
// Une semaine est désignée par (année ISO, numéro), jamais par son numéro seul :
// une grille de trimestre peut enjamber deux années ISO.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { WeekRef } from '../lib/appDate'

/** `objectifId|annéeISO|semaine` → note 1–3. */
export type QuarterRatings = Map<string, number>

export function quarterRatingKey(objectiveId: string, isoYear: number, weekNo: number): string {
  return `${objectiveId}|${isoYear}|${weekNo}`
}

function weekKey(isoYear: number, weekNo: number): string {
  return `${isoYear}|${weekNo}`
}

/** Map vide partagée : une nouvelle à chaque rendu invaliderait les `useMemo` appelants. */
export const NO_RATINGS: QuarterRatings = new Map()

export function useQuarterRatings(
  objectiveIds: string[],
  weeks: WeekRef[],
  quarter: number | undefined,
) {
  const { status, session } = useAuth()
  const userId = session?.user.id

  const weekKeys = weeks.map((w) => weekKey(w.isoYear, w.weekNo))
  const isoYears = [...new Set(weeks.map((w) => w.isoYear))]
  const weekNumbers = [...new Set(weeks.map((w) => w.weekNo))]

  return useQuery({
    queryKey: queryKeys.review.ratingsByQuarter(objectiveIds, weekKeys, quarter ?? 0),
    enabled:
      status === 'signedIn' && !!userId && objectiveIds.length > 0 && weeks.length > 0,
    queryFn: async (): Promise<QuarterRatings> => {
      // Le filtre est un produit (années × numéros) : il peut ramener une ou
      // deux semaines de trop à la charnière des années. C'est sans conséquence,
      // la jointure ci-dessous ne retient que les couples réellement demandés.
      const { data: reviews, error: reviewError } = await supabase
        .from('review')
        .select('id, period_year, period_index')
        .eq('user_id', userId!)
        .eq('period_type', 'week')
        .in('period_year', isoYears)
        .in('period_index', weekNumbers)
      if (reviewError) throw reviewError

      const wanted = new Set(weekKeys)
      const weekByReview = new Map<string, { isoYear: number; weekNo: number }>()
      for (const r of reviews ?? []) {
        if (!r.id || r.period_index === null) continue
        if (!wanted.has(weekKey(r.period_year, r.period_index))) continue
        weekByReview.set(r.id, { isoYear: r.period_year, weekNo: r.period_index })
      }
      if (weekByReview.size === 0) return new Map()

      const { data: items, error: itemError } = await supabase
        .from('review_item')
        .select('review_id, objective_id, rating')
        .in('objective_id', objectiveIds)
        .in('review_id', [...weekByReview.keys()])
      if (itemError) throw itemError

      const ratings: QuarterRatings = new Map()
      for (const item of items ?? []) {
        const week = item.review_id ? weekByReview.get(item.review_id) : undefined
        if (!week || !item.objective_id || item.rating === null) continue
        ratings.set(quarterRatingKey(item.objective_id, week.isoYear, week.weekNo), item.rating)
      }
      return ratings
    },
  })
}
