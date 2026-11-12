// Ce que le service worker (src/sw.ts) et l'app se disent. Module pur, sans
// DOM ni API de SW : il est importé des deux côtés et testé en Node.

/** Le `tag` de la notification quotidienne : un résumé remplace le précédent. */
export const DIGEST_NOTIFICATION_TAG = 'daily-digest'

/** Message SW → page : « navigue vers ce chemin » (tap sur une notification). */
export const SW_NAVIGATE = 'clarity:navigate'

/** Où mène une notification sans destination exploitable. */
export const DEFAULT_NOTIFICATION_PATH = '/ma-journee'

/**
 * Le chemin d'une notification ne vient que du serveur, mais il traverse un
 * service push tiers et finit dans `openWindow()` : on n'accepte qu'un chemin
 * interne (« /… », jamais « //hôte » ni une URL absolue).
 */
export function safeNotificationPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_NOTIFICATION_PATH
  if (!/^\/(?![/\\])[^\s]*$/.test(value)) return DEFAULT_NOTIFICATION_PATH
  return value
}
