import { useSyncExternalStore } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import {
  getTransportFailures,
  subscribeToConnectivity,
} from '../lib/connectivity'

/**
 * `ok` : rien à dire, et c'est le cas de très loin le plus fréquent.
 * `syncing` : une liaison qu'on a vue tomber, et des requêtes en cours.
 * `offline` : des requêtes n'atteignent pas le serveur, et rien n'est en vol.
 */
export type SyncStatus = 'ok' | 'syncing' | 'offline'

/**
 * L'état de la liaison, pour la seule surface autorisée à en parler
 * (`SyncBanner`).
 *
 * Il ne vient pas de `navigator.onLine` mais de l'issue réelle des requêtes
 * (`connectivity.ts`), et il se répare tout seul : le premier succès remet le
 * compteur à zéro.
 */
export function useSyncStatus(): SyncStatus {
  const failures = useSyncExternalStore(
    subscribeToConnectivity,
    getTransportFailures,
    // Rendu serveur : il n'y en a pas, mais `useSyncExternalStore` exige un
    // instantané côté serveur dès que le hook est appelé pendant l'hydratation.
    getTransportFailures,
  )
  const fetching = useIsFetching()

  if (failures === 0) return 'ok'
  return fetching > 0 ? 'syncing' : 'offline'
}
