import { QueryCache, QueryClient } from '@tanstack/react-query'
import { classifyError, isRetryableKind } from './queryError'

// Fenêtre de retry courte et dense. Le cas nominal est un 401 PGRST301
// (« JWT issued at future ») sur les toutes premières requêtes suivant un
// signup/signin : il se résorbe en ~1 s. Le backoff exponentiel par défaut
// (1 s, 2 s, 4 s) ferait patienter bien après la résorption ; on préfère
// quatre tentatives serrées couvrant ~2,6 s.
const AUTH_RETRY_DELAYS_MS = [150, 400, 900, 1200]

// L'offline est déjà retenté trois fois en interne par postgrest-js (1/2/4 s
// sur les GET) : inutile d'empiler, deux passes espacées suffisent.
const OFFLINE_RETRY_DELAYS_MS = [1_000, 3_000]

function delaysFor(error: unknown): number[] | null {
  const kind = classifyError(error)
  if (!isRetryableKind(kind)) return null
  return kind === 'offline' ? OFFLINE_RETRY_DELAYS_MS : AUTH_RETRY_DELAYS_MS
}

export const queryClient = new QueryClient({
  // Journalisation technique centralisée, une seule fois par query, quand elle
  // a épuisé ses tentatives. On logue l'objet entier, jamais `error.message`
  // seul : `hint` est souvent le champ le plus actionnable d'une erreur
  // PostgREST. L'UI, elle, n'affiche que la copie de errorMessage.ts.
  //
  // Rien d'autre ici : surtout pas de `refreshSession()`. Le token du cas
  // PGRST301 est déjà frais — en redemander un minterait un `iat` encore plus
  // récent, donc encore plus « futur » pour le vérifieur. Et c'est inutile pour
  // le cas voisin du token expiré : chaque tentative re-résout son bearer via
  // auth.getSession(), qui rafraîchit tout seul. Un refresh manuel ne ferait
  // qu'ajouter 8 appels concurrents (un par query de l'écran) contre le rate
  // limit `token_refresh` et la rotation des refresh tokens.
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('[query]', query.queryKey, classifyError(error), error)
    },
  }),
  defaultOptions: {
    queries: {
      // La fraîcheur temps réel passe par l'invalidation explicite (Realtime
      // signal-only) ; le refetch-on-focus par défaut reste comme filet.
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const delays = delaysFor(error)
        return delays !== null && failureCount < delays.length
      },
      retryDelay: (failureCount, error) => delaysFor(error)?.[failureCount] ?? 1_000,
    },
    // Mutations : pas de retry global. Un insert non idempotent retenté crée un
    // doublon — c'est à chaque hook de l'opter s'il est sûr (cf. useToggleTask).
  },
})
