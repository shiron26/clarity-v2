// Relevé par période : LA source de vérité de la progression (SPEC §4.1).
// `target` y est figée période par période — le client ne recalcule jamais ces
// valeurs à partir de ses tâches, il les lit.
//
// La période est la semaine ou le mois selon `objective.period_unit` : une seule
// table pour les deux, d'où l'unité dans la clé d'index comme dans la query key.
import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import { periodYearFor } from '../lib/objectivePeriod'
import type { Objective } from './useObjectives'

export type PeriodUnit = 'week' | 'month'

export type ObjectivePeriod = {
  objective_id: string
  period_unit: PeriodUnit
  period_year: number
  period_index: number
  target: number
  done: number
}

function periodsQueryOptions(
  objectiveIds: string[],
  unit: PeriodUnit,
  periodYear: number | undefined,
  signedIn: boolean,
) {
  return {
    queryKey: queryKeys.objectivePeriod.byObjectives(objectiveIds, unit, periodYear ?? 0),
    enabled: signedIn && objectiveIds.length > 0 && !!periodYear,
    queryFn: async (): Promise<ObjectivePeriod[]> => {
      const { data, error } = await supabase
        .from('objective_period')
        .select('objective_id, period_unit, period_year, period_index, target, done')
        .in('objective_id', objectiveIds)
        .eq('period_unit', unit)
        .eq('period_year', periodYear!)
      if (error) throw error
      return data as ObjectivePeriod[]
    },
  }
}

export function useObjectivePeriods(
  objectiveIds: string[],
  unit: PeriodUnit,
  periodYear: number | undefined,
) {
  const { status } = useAuth()
  return useQuery(periodsQueryOptions(objectiveIds, unit, periodYear, status === 'signedIn'))
}

/**
 * Les relevés d'un jeu d'objectifs, **quelle que soit leur unité**.
 *
 * Les deux unités n'ont pas la même année : `period_year` vaut l'année **ISO** en
 * hebdomadaire, l'année **civile** en mensuel. Les confondre ne lève aucune
 * erreur — les périodes de charnière manquent simplement, en silence. L'appelant
 * dit donc quelles années ISO couvrir (une semaine en couvre une, un trimestre
 * jusqu'à deux, une année civile jusqu'à trois) et quelle année civile.
 *
 * Cinq écrans recopiaient ce découpage, commentaire compris, avec une échelle
 * `weeksAQuery`/`B`/`C` née du nombre variable d'années. `useQueries` la remplace.
 */
export function useObjectivePeriodsFor(
  objectives: Objective[],
  weekYears: number[],
  monthYear: number | undefined,
) {
  const { status } = useAuth()
  const signedIn = status === 'signedIn'

  const weekIds = useMemo(
    () => objectives.filter((o) => o.period_unit === 'week').map((o) => o.id),
    [objectives],
  )
  const monthIds = useMemo(
    () => objectives.filter((o) => o.period_unit === 'month').map((o) => o.id),
    [objectives],
  )

  // `combine` plutôt qu'un `useMemo` : le nombre d'années varie, donc un tableau
  // de dépendances bâti depuis les résultats changerait de taille entre deux
  // rendus. TanStack mémoïse la valeur combinée pour nous.
  return useQueries({
    queries: [
      ...weekYears.map((weekYear) => periodsQueryOptions(weekIds, 'week', weekYear, signedIn)),
      periodsQueryOptions(monthIds, 'month', monthYear, signedIn),
    ],
    combine: (results) => ({
      periods: results.flatMap((r) => r.data ?? []),
      queries: results,
    }),
  })
}

/**
 * Les relevés couvrant une **année civile** entière — Année, Trimestre, bilan
 * annuel. Une année civile mord sur l'année ISO précédente (la semaine du
 * 1er janvier) comme sur la suivante (celle du 31 décembre).
 */
export function useObjectivePeriodsForYear(objectives: Objective[], year: number | undefined) {
  const weekYears = useMemo(() => {
    if (!year) return []
    return [
      ...new Set([
        periodYearFor('week', `${year}-01-01`),
        year,
        periodYearFor('week', `${year}-12-31`),
      ]),
    ]
  }, [year])

  return useObjectivePeriodsFor(objectives, weekYears, year)
}

/**
 * Clé d'un relevé. L'unité ET l'année en font partie : un numéro de période seul
 * est ambigu dès qu'une grille de trimestre enjambe deux années ISO (semaine 53
 * de 2025 et semaine 53 de 2026 porteraient la même clé).
 */
export function periodKey(
  objectiveId: string,
  unit: PeriodUnit,
  periodYear: number,
  periodIndex: number,
) {
  return `${objectiveId}|${unit}|${periodYear}|${periodIndex}`
}

/**
 * Cumul des jours crédités par objectif, sur toutes les périodes chargées.
 *
 * `useObjectivePeriods` charge une année entière : la somme des `done` est donc
 * le total réel de séances de l'objectif — le « 62 » de « 62 sur 100 ». C'est
 * bien `done` et non `least(done, target)` : on cumule ce qui a été fait, pas ce
 * qui comptait pour la régularité.
 */
export function sumDoneByObjective(periods: ObjectivePeriod[] | undefined) {
  const map = new Map<string, number>()
  for (const p of periods ?? []) {
    map.set(p.objective_id, (map.get(p.objective_id) ?? 0) + p.done)
  }
  return map
}

/** Index clé → relevé, pour un accès direct depuis les cartes. */
export function indexPeriods(periods: ObjectivePeriod[] | undefined) {
  const map = new Map<string, ObjectivePeriod>()
  for (const p of periods ?? []) {
    map.set(periodKey(p.objective_id, p.period_unit, p.period_year, p.period_index), p)
  }
  return map
}
