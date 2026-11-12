// « Ma journée » : lectures et écritures (SPEC-MA-JOURNEE §4).
//
// Les tâches n'y sont pas : la page les lit par `useTasks`, exactement comme la
// vue « Aujourd'hui » de /taches (voir l'en-tête de la migration day_read).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/useAuth'
import { supabase } from '../../lib/supabase'
import { queryKeys } from '../../lib/queryKeys'
import { retryAuthTransient } from '../../lib/queryError'
import type { IsoDate } from '../../lib/appDate'

export type DayEvent = {
  title: string
  calendar: string
  location: string | null
  all_day: boolean
  starts_at: string
  ends_at: string
  /** "HH:MM" dans le fuseau de l'application, formaté par le serveur. */
  start_time: string
  end_time: string
}

export type DayEmail = {
  from_name: string
  subject: string
  received_at: string
  /** Jour et heure de réception dans le fuseau de l'application. */
  received_on: IsoDate
  received_time: string
  url: string | null
  /** Le marqueur « important » de Gmail : sépare les deux listes de l'écran. */
  important: boolean
}

export type DayBirthday = {
  id: string
  name: string
  first_name: string
  age: number | null
  phone: string | null
  message: string
}

export type MyDay = {
  date: IsoDate
  /** Synchro Google en panne (plus de 26 h). L'heure exacte se lit dans les réglages. */
  sync: { stale: boolean }
  events: { today: DayEvent[]; tomorrow: DayEvent[] }
  emails: DayEmail[]
  birthdays: {
    today: DayBirthday[]
    tomorrow: Pick<DayBirthday, 'id' | 'name' | 'age'>[]
  }
}

/** `today` vient de `useAppToday` : la date du serveur, jamais celle du navigateur. */
export function useMyDay(today: IsoDate | undefined) {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.myDay.byDate(today ?? ''),
    enabled: status === 'signedIn' && !!today,
    // Le collecteur pousse au plus une fois par heure : inutile de relire plus.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MyDay> => {
      const { data, error } = await supabase.rpc('get_my_day', { p_date: today! })
      if (error) throw error
      // Forme garantie par la fonction SQL ; `Json` n'en dit rien au typage.
      return data as unknown as MyDay
    },
  })
}

// ─── Réglages ───────────────────────────────────────────────────────────────

export type IngestToken = {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export function useIngestTokens() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.ingestToken.all,
    enabled: status === 'signedIn',
    queryFn: async (): Promise<IngestToken[]> => {
      const { data, error } = await supabase
        .from('ingest_token')
        .select('id, label, created_at, last_used_at, revoked_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as IngestToken[]
    },
  })
}

/** Rend le jeton EN CLAIR, une seule fois : l'écran doit le garder tant qu'il est ouvert. */
export function useCreateIngestToken() {
  const queryClient = useQueryClient()
  return useMutation({
    // Pas de retry au-delà du 401 transitoire : un second essai créerait un
    // second jeton.
    retry: retryAuthTransient,
    mutationFn: async (label: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_ingest_token', { p_label: label })
      if (error) throw error
      return data
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.ingestToken.all }),
  })
}

export function useRevokeIngestToken() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('revoke_ingest_token', { p_id: id })
      if (error) throw error
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.ingestToken.all }),
  })
}

export function useUpdateDigestSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async (patch: {
      enabled?: boolean
      sendTime?: string
      template?: string
    }) => {
      const { error } = await supabase.rpc('update_digest_settings', {
        p_enabled: patch.enabled,
        p_send_time: patch.sendTime,
        p_birthday_message_template: patch.template,
      })
      if (error) throw error
    },
    onSettled: (_data, _error, patch) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.digestSettings.all })
      // Seul le modèle de message se lit dans « Ma journée ».
      if (patch.template !== undefined) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.myDay.all })
      }
    },
  })
}

export type PushDevice = {
  id: string
  user_agent: string | null
  created_at: string
  last_success_at: string | null
}

export function usePushDevices() {
  const { status } = useAuth()
  return useQuery({
    queryKey: queryKeys.pushSubscription.all,
    enabled: status === 'signedIn',
    queryFn: async (): Promise<PushDevice[]> => {
      const { data, error } = await supabase
        .from('push_subscription')
        .select('id, user_agent, created_at, last_success_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as PushDevice[]
    },
  })
}

export function useRemovePushDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('remove_push_subscription', { p_id: id })
      if (error) throw error
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.pushSubscription.all }),
  })
}

/** Le résumé du jour, tout de suite, sur mes appareils (SPEC §5.3). */
export function useSendTestNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: retryAuthTransient,
    mutationFn: async (): Promise<{ sent: number }> => {
      const { data, error } = await supabase.functions.invoke('send-digests', {
        body: { test: true },
      })
      if (error) throw error
      return data as { sent: number }
    },
    // `last_success_at` a bougé, ou un appareil mort a été retiré.
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.pushSubscription.all }),
  })
}
