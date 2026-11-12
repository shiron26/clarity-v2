// Abonnement Web Push de l'appareil (SPEC-MA-JOURNEE §6). Infra non-React.
//
// Trois contraintes iOS commandent ce module :
//   · le push n'existe que dans la PWA AJOUTÉE À L'ÉCRAN D'ACCUEIL (iOS 16.4+),
//     jamais dans Safari : `pushSupport()` le dit avant qu'on propose quoi que ce
//     soit ;
//   · la permission ne se demande qu'en réponse à un GESTE (un clic), jamais au
//     chargement, sinon iOS refuse sans même afficher la question ;
//   · un abonnement peut changer ou disparaître sans prévenir : on le
//     réenregistre à chaque ouverture (`resyncPushSubscription`).
import { isStandalone } from './displayMode'
import { supabase } from './supabase'

export type PushSupport =
  | 'ok'
  /** Navigateur sans Web Push, ou clé VAPID absente de la build. */
  | 'unsupported'
  /** iPhone / iPad dans Safari : il faut d'abord ajouter l'app à l'écran d'accueil. */
  | 'needsInstall'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** iPadOS se présente comme un Mac ; seul l'écran tactile le trahit. */
function isIpad(): boolean {
  return /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isIos(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent) || isIpad()
}

export function pushSupport(): PushSupport {
  if (isIos() && !isStandalone()) return 'needsInstall'
  if (!VAPID_PUBLIC_KEY) return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  return 'ok'
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

function vapidKeyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Le SW n'existe qu'en build (`npm run preview`) : en dev, `ready` ne se résout jamais. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

async function register(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: deviceLabel(),
  })
  if (error) throw error
}

/** « iPhone », « Mac »… : ce que les réglages affichent pour reconnaître l'appareil. */
function deviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (isIpad()) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Navigateur'
}

/**
 * Reprend l'abonnement du navigateur, ou en crée un, puis l'enregistre côté
 * serveur. Les options d'abonnement ne vivent qu'ici.
 */
async function ensureSubscription(reg: ServiceWorkerRegistration): Promise<void> {
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // `pushSupport()` a déjà vérifié la clé : sans elle, on n'arrive pas ici.
      applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY!),
    }))
  await register(sub)
}

/**
 * À appeler DEPUIS UN CLIC. Demande la permission si besoin, abonne l'appareil
 * et l'enregistre. Rend la permission finale : `denied` ne se rattrape que dans
 * les réglages du système.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (pushSupport() !== 'ok') return 'denied'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const reg = await registration()
  if (!reg) throw new Error('Service worker indisponible (les notifications exigent une build)')
  await ensureSubscription(reg)
  return permission
}

/** Désabonne CET appareil, côté navigateur et côté serveur. */
export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const { error } = await supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
  if (error) throw error
}

/** Cet appareil est-il abonné (côté navigateur) ? */
export async function hasPushSubscription(): Promise<boolean> {
  const reg = await registration()
  return !!(await reg?.pushManager.getSubscription())
}

/**
 * À chaque ouverture, si la permission est déjà accordée : réenregistre
 * l'abonnement (upsert idempotent côté serveur), ou en recrée un si le
 * navigateur l'a perdu. Jamais de demande de permission ici.
 */
export async function resyncPushSubscription(): Promise<void> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return
  const reg = await registration()
  if (!reg) return
  await ensureSubscription(reg)
}
