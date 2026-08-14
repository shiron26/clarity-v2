// Quand chaque rituel de review s'ouvre (SPEC §4.4 : vendredi 18h en hebdo,
// dernier vendredi du trimestre en bilan).
//
// La règle vit côté serveur (`public.review_openings`) pour deux raisons : « 18h »
// est une heure murale dans le fuseau de l'application, invisible du rôle API, et
// la comparaison à « maintenant » doit se faire contre l'horloge du serveur —
// sinon un navigateur en avance déverrouillerait la review avant l'heure.
//
// Plusieurs années d'un coup parce qu'une grille de trimestre peut enjamber deux
// années ISO : une période s'identifie par le triplet (type, année, index), pas
// par son index seul.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type Opening = { openAt: string; isOpen: boolean }

/** `'week:2026:33'` / `'quarter:2026:3'` / `'year:2026'` → ouverture. */
export type OpeningsByPeriod = Map<string, Opening>

export function openingKey(
  periodType: string,
  periodYear: number,
  periodIndex: number | null,
): string {
  return periodIndex === null
    ? `${periodType}:${periodYear}`
    : `${periodType}:${periodYear}:${periodIndex}`
}

export function useReviewOpenings(years: number[]) {
  const { status } = useAuth()
  const sorted = [...new Set(years)].sort()

  return useQuery({
    queryKey: queryKeys.review.openings(sorted),
    enabled: status === 'signedIn' && sorted.length > 0,
    // `is_open` bascule au fil de la journée, mais jamais d'une seconde à
    // l'autre : le même palier que les autres ancres de date suffit.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OpeningsByPeriod> => {
      const { data, error } = await supabase.rpc('review_openings', { p_years: sorted })
      if (error) throw error

      const openings: OpeningsByPeriod = new Map()
      for (const row of data ?? []) {
        openings.set(openingKey(row.period_type, row.period_year, row.period_index), {
          openAt: row.open_at,
          isOpen: row.is_open,
        })
      }
      return openings
    },
  })
}
