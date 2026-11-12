// Réglages de « Ma journée » et date de dernière consultation.
//
// Transverse : l'écran « Ma journée » les règle et marque sa consultation, le
// dashboard lit la consultation pour colorer (ou éteindre) son bouton d'accès.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../features/auth/useAuth'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { retryAuthTransient } from '../lib/queryError'
import type { IsoDate } from '../lib/appDate'
import type { Database } from '../types/database'

type Row = Database['public']['Views']['digest_settings']['Row']

/**
 * La ligne de la vue, telle que générée — les colonnes suivent la base sans
 * recopie — resserrée sur ce que garantit `digest_settings_rows()` : les trois
 * premières colonnes ont toujours une valeur (défauts compris).
 * `send_time` est "HH:MM:SS" dans le fuseau de l'application ; `last_viewed_on`
 * est le jour applicatif de la dernière ouverture de « Ma journée ».
 */
export type DigestSettings = {
  [K in keyof Row]: K extends 'enabled' | 'send_time' | 'birthday_message_template'
    ? NonNullable<Row[K]>
    : K extends 'last_sent_on' | 'last_viewed_on'
      ? IsoDate | null
      : Row[K]
}

export function useDigestSettings() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.digestSettings.all,
    enabled: status === 'signedIn',
    queryFn: async (): Promise<DigestSettings> => {
      const { data, error } = await supabase
        .from('digest_settings')
        .select('*')
        .single()
      if (error) throw error
      return data as DigestSettings
    },
  })
}

/**
 * Marque « Ma journée » comme consultée aujourd'hui. Le jour est posé par le
 * serveur : le client ne dit que « je l'ai ouverte ».
 */
export function useMarkMyDayViewed() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: retryAuthTransient,
    // `today` est la date du serveur (`useAppToday`), celle-là même que la RPC
    // pose : le cache peut la reprendre sans relire la ligne.
    mutationFn: async (_today: IsoDate) => {
      const { error } = await supabase.rpc('mark_my_day_viewed')
      if (error) throw error
    },
    onSuccess: (_data, today) =>
      queryClient.setQueryData<DigestSettings>(queryKeys.digestSettings.all, (old) =>
        old ? { ...old, last_viewed_on: today } : old,
      ),
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.digestSettings.all }),
  })
}
