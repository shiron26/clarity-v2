// « Aujourd'hui » vient du serveur, jamais de l'horloge du navigateur : le
// fuseau de l'application est unique pour tous les utilisateurs (SPEC §2) et
// n'est pas lisible côté client. Toute l'arithmétique de dates du dashboard
// s'ancre sur cette valeur — voir src/lib/appDate.ts.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import type { IsoDate } from '../lib/appDate'

export function useAppToday() {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.appToday,
    enabled: status === 'signedIn',
    // La date ne change qu'à minuit : inutile de la redemander en continu.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<IsoDate> => {
      const { data, error } = await supabase.rpc('app_today')
      if (error) throw error
      return data
    },
  })
}

/**
 * Instant de début de la journée applicative (timestamptz ISO). `app_today()`
 * donne la date, celle-ci l'instant : c'est la seule borne comparable à un
 * `completed_at`, qui porte une heure. Sert à ne garder à l'écran que les tâches
 * cochées **aujourd'hui** (SPEC §5 : « jusqu'à la fin du jour »).
 */
export function useAppDayStart() {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.appDayStart,
    enabled: status === 'signedIn',
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('app_day_start')
      if (error) throw error
      return data
    },
  })
}
