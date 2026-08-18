// L'état agrégé des queries d'un écran : y a-t-il une erreur à montrer, et que
// relancer quand l'utilisateur clique « Réessayer » ?
//
// Six écrans portaient la même quinzaine de lignes — dont deux qui redéclaraient
// `QueryLike` **dans leur corps de fonction**. La politique « ne relancer que ce
// qui a échoué » (les queries saines gardent leur cache) vit désormais ici, en un
// seul endroit modifiable.

/**
 * Type **structurel** : les `UseQueryResult<T>` n'ont pas de type nominal commun
 * — leur paramètre de données diffère d'une query à l'autre — et on n'a besoin
 * ici que de ces trois membres.
 */
export type QueryLike = {
  error: Error | null
  isFetching: boolean
  refetch: () => Promise<unknown>
}

/**
 * `extraError` couvre les erreurs qu'on veut **afficher sans pouvoir les
 * retenter** : un hook composite porte ses propres queries (le rituel du
 * dashboard) ou une mutation a échoué (l'ouverture d'un bilan). Sans elle,
 * l'encart concerné disparaîtrait en silence.
 */
export function useQueriesState(queries: QueryLike[], extraError?: Error | null) {
  const failed = queries.filter((q) => q.error !== null)

  return {
    firstError: failed[0]?.error ?? extraError ?? null,
    retrying: failed.some((q) => q.isFetching),
    onRetry: () => {
      for (const query of failed) void query.refetch()
    },
  }
}
