// Objectifs de l'année. Le tri se fait sur `slot` : c'est l'emplacement figé qui
// porte l'identité visuelle (SPEC §3). Un slot libéré laisse un trou — les
// cartes ne se décalent jamais.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type Objective = {
  id: string
  user_id: string | null
  space_id: string | null
  parent_objective_id: string | null
  year: number
  kind: string | null
  slot: number | null
  label: string
  title: string
  why: string | null
  description: string | null
  cadence: number | null
  closed_at: string | null
}

const COLUMNS =
  'id, user_id, space_id, parent_objective_id, year, kind, slot, label, title, why, description, cadence, closed_at'

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
