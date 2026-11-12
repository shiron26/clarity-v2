// Le pont entre le service worker et l'app, monté une fois sous l'authentification.
//
//  · Tap sur une notification : le SW envoie `SW_NAVIGATE` à l'onglet existant,
//    l'app navigue elle-même (react-router), sans rechargement.
//  · À chaque ouverture connectée : l'abonnement push de l'appareil est
//    réenregistré s'il existe déjà une permission (SPEC-MA-JOURNEE §6).
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { resyncPushSubscription } from '../lib/push'
import { SW_NAVIGATE, safeNotificationPath } from '../lib/pushMessages'

export function usePushBridge() {
  const navigate = useNavigate()
  const { status, session } = useAuth()
  // L'id, jamais l'objet `session` : TOKEN_REFRESHED change son identité.
  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; path?: unknown } | null
      if (data?.type === SW_NAVIGATE) void navigate(safeNotificationPath(data.path))
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    if (status !== 'signedIn' || !userId) return
    resyncPushSubscription().catch((error: unknown) => {
      // Sans conséquence immédiate : l'appareil reste enregistré tel qu'avant.
      console.error('Réenregistrement push', error)
    })
  }, [status, userId])
}
