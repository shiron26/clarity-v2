import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * Vrai quand l'utilisateur a demandé à réduire les animations.
 *
 * Les effets de célébration du produit (pop de carte, gerbes de particules,
 * repli de ligne) sont des ornements : ils doivent disparaître. En revanche
 * les changements d'ÉTAT — une carte qui passe de grise à colorée — restent,
 * sans quoi l'interface ne dirait plus rien.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
