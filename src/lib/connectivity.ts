// L'état de la liaison avec le serveur, pour l'application entière.
//
// Il ne se lit PAS dans `navigator.onLine`, qui répond « en ligne » dès qu'une
// interface réseau existe : un téléphone qui se réveille sur un Wi-Fi sans
// Internet, un portail captif d'hôtel ou un tunnel VPN qui remonte sont tous
// « en ligne » pour le navigateur. Le seul juge fiable est l'issue réelle des
// requêtes, et le `QueryCache` la connaît déjà.
//
// Le compteur ne bouge que sur un échec de TRANSPORT (`offline`, cf.
// `queryError.ts`) : un 502 ou une règle métier ne disent rien de la liaison.
// Et il ne bouge qu'après épuisement des tentatives — le `QueryCache.onError`
// de TanStack ne se déclenche pas avant.
//
// Volontairement hors React et hors TanStack : c'est un état de l'application,
// pas la donnée d'un écran. Les composants le lisent par `useSyncStatus`.

let consecutiveFailures = 0
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Une requête n'a pas atteint le serveur, tentatives comprises. */
export function noteTransportFailure() {
  consecutiveFailures += 1
  emit()
}

/** Une requête a abouti : la liaison est là, quoi qu'on ait cru jusqu'ici. */
export function noteRequestSuccess() {
  if (consecutiveFailures === 0) return
  consecutiveFailures = 0
  emit()
}

/** Pour `useSyncExternalStore` : un nombre, donc une référence stable. */
export function getTransportFailures() {
  return consecutiveFailures
}

export function subscribeToConnectivity(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Réservé aux tests : remet le module dans son état de départ. */
export function resetConnectivity() {
  consecutiveFailures = 0
  listeners.clear()
}
