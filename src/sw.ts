/// <reference lib="webworker" />
// Service worker de Clarity (stratégie `injectManifest` de vite-plugin-pwa).
//
// Il a remplacé le SW généré (`generateSW`) le jour où il a fallu recevoir des
// notifications : un SW généré ne porte pas de gestionnaire `push`. Il reproduit
// donc À L'IDENTIQUE ce que faisait l'ancien, et rien de plus :
//   · précache de la coquille (`self.__WB_MANIFEST`, injecté au build) ;
//   · repli de navigation SPA sur `/index.html`, avec le même denylist ;
//   · purge des précaches périmés ;
//   · mise à jour sur demande seulement (message `SKIP_WAITING` envoyé par
//     `updateServiceWorker()` d'UpdateBanner), jamais de `skipWaiting()` seul.
//
// Toujours AUCUNE route runtime (AGENTS.md, « PWA ») : les vues `public.*`
// renvoient du clair déchiffré, rien de PostgREST ne va en Cache Storage. Le
// repli de navigation ne sert que l'index précaché.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import {
  DIGEST_NOTIFICATION_TAG,
  SW_NAVIGATE,
  badgeFromPayload,
  safeNotificationPath,
} from './lib/pushMessages'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Aucune route de l'app ne contient de point : ce qui y ressemble est un
// fichier, et servir index.html à sa place masquerait un asset manquant.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/\/[^/?]+\.[^/?]*$/],
  }),
)

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// ─── Notifications ──────────────────────────────────────────────────────────

type DigestPayload = { title?: unknown; body?: unknown; url?: unknown; badge?: unknown }

self.addEventListener('push', (event) => {
  let payload: DigestPayload = {}
  try {
    payload = (event.data?.json() as DigestPayload | undefined) ?? {}
  } catch {
    // Corps illisible : on affiche quand même une notification, iOS révoque
    // l'abonnement d'une app qui reçoit un push sans en montrer.
  }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Clarity'
  const body = typeof payload.body === 'string' ? payload.body : ''

  const badge = badgeFromPayload(payload.badge)

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        // Un résumé remplace le précédent au lieu de s'empiler.
        tag: DIGEST_NOTIFICATION_TAG,
        icon: '/icon-192.png',
        data: { url: safeNotificationPath(payload.url) },
      }),
      // La pastille ne doit jamais empêcher la notification : sans support ou
      // sans permission, l'appel est absent ou rejette, et on s'en passe.
      badge !== null && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(badge).catch(() => undefined)
        : undefined,
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = safeNotificationPath((event.notification.data as { url?: unknown } | null)?.url)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin)
      if (existing) {
        // L'app navigue elle-même (react-router) : pas de rechargement, et ça
        // marche aussi pour un onglet que ce SW ne contrôle pas encore, là où
        // `client.navigate()` échouerait.
        await existing.focus()
        existing.postMessage({ type: SW_NAVIGATE, path })
        return
      }
      await self.clients.openWindow(path)
    })(),
  )
})
