// Hooks Realtime « signal only » — règle produit (SPEC §2) : le payload ne se
// lit JAMAIS (il peut contenir des lignes chiffrées) ; une notification sert
// uniquement à invalider les queries concernées.
//
// Deps des effets : `status` et des ids stables — jamais l'objet `session`
// (TOKEN_REFRESHED en change l'identité toutes les ~50 min → resubscriptions
// parasites ; supabase-js re-signe lui-même les canaux).
import { useEffect } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'

/**
 * postgres_changes sur public.review (seule table de la publication) :
 * curseur partagé + validation d'une session de review.
 * filter ex. : `id=eq.${reviewId}` ou `space_id=eq.${spaceId}`
 */
export function useReviewChangesInvalidation(filter: string | null, keys: readonly QueryKey[]) {
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const keysJson = JSON.stringify(keys) // dep stable même si l'appelant passe un littéral

  useEffect(() => {
    if (status !== 'signedIn' || !filter) return

    const channel = supabase
      .channel(`review-changes:${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review', filter }, () => {
        // payload ignoré — signal only
        for (const queryKey of JSON.parse(keysJson) as QueryKey[]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [status, filter, keysJson, queryClient])
}

/**
 * Broadcast `space:<space_id>` — canal PRIVÉ : la policy
 * space_members_receive_broadcasts (migration 0010) n'autorise que les membres
 * actifs de l'espace. Le trigger DB émet l'event 'invalidate' à chaque écriture
 * de review_item. Nom de canal et nom d'event EXACTS, sinon rien ne passe.
 */
export function useSpaceBroadcastInvalidation(spaceId: string | null, keys: readonly QueryKey[]) {
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const keysJson = JSON.stringify(keys)

  useEffect(() => {
    if (status !== 'signedIn' || !spaceId) return
    let cancelled = false
    let channel: RealtimeChannel | null = null

    const subscribe = async () => {
      // Canal privé : le socket Realtime doit porter le JWT utilisateur AVANT
      // le join (l'auto-propagation du client peut arriver après nous).
      await supabase.realtime.setAuth()
      if (cancelled) return // StrictMode double-mount / unmount pendant l'await

      channel = supabase
        .channel(`space:${spaceId}`, { config: { private: true } })
        .on('broadcast', { event: 'invalidate' }, () => {
          // payload ignoré — signal only
          for (const queryKey of JSON.parse(keysJson) as QueryKey[]) {
            void queryClient.invalidateQueries({ queryKey })
          }
        })
        .subscribe((subStatus, err) => {
          if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
            console.warn(`[realtime] space:${spaceId} — ${subStatus}`, err)
          }
        })
    }

    void subscribe()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
    }
  }, [status, spaceId, keysJson, queryClient])
}
