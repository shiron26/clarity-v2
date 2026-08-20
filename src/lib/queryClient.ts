import { QueryCache, QueryClient } from '@tanstack/react-query'
import { noteRequestSuccess, noteTransportFailure } from './connectivity'
import { logQueryError } from './errorLog'
import { classifyError } from './queryError'
import { retryDelay, shouldRetryQuery } from './retryPolicy'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Trois choses, une seule fois par query, quand elle a épuisé ses tentatives.
    //
    // 1. La journalisation technique. On logue l'objet entier, jamais
    //    `error.message` seul : `hint` est souvent le champ le plus actionnable
    //    d'une erreur PostgREST. L'UI, elle, n'affiche que la copie de
    //    errorMessage.ts.
    // 2. Le journal local (`errorLog.ts`), parce que sur la PWA d'un téléphone
    //    la console n'existe pas et que ces pannes-là arrivent la nuit.
    // 3. L'état de liaison (`connectivity.ts`), qui alimente la seule surface
    //    autorisée à parler de réseau : la pastille de `SyncBanner`.
    //
    // Ce qu'on ne fait toujours PAS ici : un `refreshSession()`. Le token du cas
    // PGRST301 est déjà frais — en redemander un minterait un `iat` encore plus
    // récent, donc encore plus « futur » pour le vérifieur. Et c'est inutile pour
    // le cas voisin du token expiré : chaque tentative re-résout son bearer via
    // auth.getSession(), qui rafraîchit tout seul. La remise en état du jeton au
    // réveil est le travail d'`appLifecycle.ts`, une fois, avant la salve.
    onError: (error, query) => {
      const kind = classifyError(error)
      console.error('[query]', query.queryKey, kind, error)
      logQueryError(query.queryKey, error)
      if (kind === 'offline') noteTransportFailure()
    },
    onSuccess: () => noteRequestSuccess(),
  }),
  defaultOptions: {
    queries: {
      // La fraîcheur temps réel passe par l'invalidation explicite (Realtime
      // signal-only) ; le refetch-on-focus reste comme filet, mais il est
      // désormais déclenché par `appLifecycle.ts` APRÈS remise en état de la
      // session, et non par l'écouteur nu de TanStack.
      staleTime: 30_000,
      // Terminal par exception, transitoire par défaut : voir `retryPolicy.ts`.
      retry: shouldRetryQuery,
      retryDelay,
    },
    // Mutations : pas de retry global. Un insert non idempotent retenté crée un
    // doublon — c'est à chaque hook de l'opter s'il est sûr (cf. useToggleTask).
  },
})
