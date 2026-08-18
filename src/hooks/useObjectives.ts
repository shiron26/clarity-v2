// Objectifs de l'année. Le tri se fait sur le DÉBUT DE FENÊTRE puis sur `slot` :
// depuis que la fenêtre peut être un trimestre, le slot seul ne suffit plus à
// ordonner (un T1 et un T3 partagent légitimement le slot 1). Le slot reste
// l'emplacement figé qui porte l'identité visuelle (SPEC §3) — un slot libéré
// laisse un trou, les cartes ne se décalent jamais.
//
// Le tri porte sur `year` puis `quarter` (nuls d'abord : un annuel commence le
// 1er janvier, donc avant un T2) plutôt que sur `window_range` : ordonner un
// daterange côté PostgREST marcherait, mais pour un résultat identique et une
// dépendance de plus.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { PeriodUnit } from './useObjectivePeriods'

/** Les trois types de mesure (REFONTE §1.2). */
export type ObjectiveMeasure = 'habitude' | 'quantite' | 'jalons'

export type Objective = {
  id: string
  user_id: string | null
  space_id: string | null
  parent_objective_id: string | null
  year: number
  /** `null` = objectif annuel. */
  quarter: number | null
  /** Fenêtre `[début, fin)` dérivée de (year, quarter), telle que PostgREST la sérialise. */
  window_range: string
  kind: string | null
  slot: number | null
  label: string
  title: string
  why: string | null
  description: string | null
  measure: ObjectiveMeasure
  period_unit: PeriodUnit | null
  cadence: number | null
  target_value: number | null
  unit: string | null
  entry_mode: 'cumul' | 'releve' | null
  direction: 'atteindre' | 'sous' | null
  closed_at: string | null
  /**
   * Le jour où l'objectif est né. Le serveur s'en sert déjà comme borne basse
   * des périodes (`private.backfill_objective_periods`) ; côté front, c'est ce
   * qui empêche de mettre au jugement une semaine que l'objectif n'a pas vécue
   * (`src/lib/reviewPeriod.ts`).
   */
  created_at: string | null
}

// Un seul littéral, volontairement long : le parseur de types de supabase-js
// lit la chaîne à la compilation, une concaténation lui rend un `string` et la
// requête retombe sur `GenericStringError[]`.
const COLUMNS =
  'id, user_id, space_id, parent_objective_id, year, quarter, window_range, kind, slot, label, title, why, description, measure, period_unit, cadence, target_value, unit, entry_mode, direction, closed_at, created_at'

export function useObjectives(year: number | undefined) {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.objective.byYear(year ?? 0),
    enabled: status === 'signedIn' && !!year,
    queryFn: async (): Promise<Objective[]> => {
      const { data, error } = await supabase
        .from('objective')
        .select(COLUMNS)
        .eq('year', year!)
        .order('year', { ascending: true })
        .order('quarter', { ascending: true, nullsFirst: true })
        .order('slot', { ascending: true })
      if (error) throw error
      return data as Objective[]
    },
  })
}

/** Les objectifs principaux perso : ceux qui portent une cadence et des tâches. */
export function selectPrincipals(objectives: Objective[] | undefined): Objective[] {
  return (objectives ?? []).filter(
    (o) => o.kind === 'principal' && o.user_id !== null && o.parent_objective_id === null,
  )
}

/**
 * Les objectifs secondaires perso : ni cadence, ni tâches, ni relevé hebdo —
 * les jalons sont leur seule mécanique (SPEC §3).
 */
export function selectSecondaries(objectives: Objective[] | undefined): Objective[] {
  return (objectives ?? []).filter(
    (o) => o.kind === 'secondaire' && o.user_id !== null && o.parent_objective_id === null,
  )
}

/** Emplacements des principaux (1–3) et des secondaires (1–5), SPEC §3. */
export const MAX_PRINCIPALS = 3
export const MAX_SECONDARIES = 5
