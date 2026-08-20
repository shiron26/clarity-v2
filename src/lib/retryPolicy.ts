// La politique de retry des LECTURES : combien de fois, et à quel rythme.
//
// Elle vit à part de `queryError.ts` (qui dit ce qu'EST une erreur) et de
// `queryClient.ts` (qui la câble à TanStack) pour une raison pratique : ce sont
// des fonctions pures, donc testables sans client ni réseau.
//
// Le principe est celui du réveil d'onglet. À cet instant, huit queries périmées
// repartent ensemble, le jeton est expiré, son renouvellement est en vol et le
// réseau du téléphone se réveille aussi. Les échecs de cette fenêtre sont
// TRANSITOIRES par nature : la bonne réponse est de retenter, pas d'afficher.
import { classifyError, isTerminalError } from './queryError'

/** Cas nominal, largement suffisant pour la fenêtre de réveil. */
const MAX_ATTEMPTS = 4

// Le PGRST301 « JWT issued at future » se résorbe en ~1 s : une fenêtre courte et
// dense le couvre, là où un backoff exponentiel ferait patienter bien après la
// résorption. Fixe et sans jitter, parce que ces tentatives-là ne se marchent
// pas dessus : elles attendent une horloge, pas un serveur.
const AUTH_DELAYS_MS = [150, 400, 900, 1200]

const BASE_MS = 500
const CAP_MS = 8_000
/** Sous 100 ms, une « nouvelle tentative » est une rafale. */
const FLOOR_MS = 100

/**
 * Backoff exponentiel à **jitter complet** : le délai est tiré au hasard dans
 * `[0, base × 2^n]`, plafonné.
 *
 * Le hasard n'est pas un détail ici. Au réveil, les queries échouent à la même
 * milliseconde ; un délai fixe les ferait retenter toutes ensemble, retomber
 * ensemble, et transformerait un hoquet en rafale contre un serveur qui se
 * relève. Le tirage les étale.
 *
 * `random` est injectable pour que le test porte sur les bornes plutôt que sur
 * une valeur (le dépôt n'a pas de faux `Math.random` global).
 */
export function transientDelay(failureCount: number, random: () => number = Math.random): number {
  const ceiling = Math.min(CAP_MS, BASE_MS * 2 ** failureCount)
  return Math.max(FLOOR_MS, Math.round(random() * ceiling))
}

/** Le délai avant la tentative n° `failureCount` (0 = la première nouvelle tentative). */
export function retryDelay(
  failureCount: number,
  error: unknown,
  random: () => number = Math.random,
): number {
  if (classifyError(error) === 'authTransient') {
    return AUTH_DELAYS_MS[failureCount] ?? AUTH_DELAYS_MS[AUTH_DELAYS_MS.length - 1]!
  }
  return transientDelay(failureCount, random)
}

/**
 * Retenter, oui ou non.
 *
 * La liste est celle des EXCEPTIONS (`isTerminalError`), et le sens compte : la
 * politique inverse — une liste blanche du retentable — laissait le fourre-tout
 * `unknown` sans aucune tentative. Un 502, un redémarrage de PostgREST ou une
 * erreur d'auth jetée pendant le renouvellement du jeton se figeaient alors
 * définitivement à l'écran, alors qu'ils passent tout seuls deux secondes plus
 * tard.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isTerminalError(error)) return false
  return failureCount < MAX_ATTEMPTS
}
