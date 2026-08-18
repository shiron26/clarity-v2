/**
 * Type **structurel**, comme `QueryLike` dans `src/hooks/useQueriesState.ts` :
 * les `UseQueryResult<T>` n'ont pas de type nominal commun, et on n'a besoin ici
 * que de ce seul membre.
 */
export type LoadableQuery = { isLoading: boolean }

/**
 * Un premier chargement est-il en cours ?
 *
 * **`isLoading` et jamais `isPending`.** Une query désactivée (`enabled: false`,
 * typiquement une liste d'identifiants vide) reste `status: 'pending'` à vie chez
 * TanStack Query v5 : `isPending` y vaut `true` pour toujours, `isLoading` non
 * (il est `isPending && isFetching`). Lire `isPending` dans un garde de
 * chargement fige donc l'écran dès qu'un objectif manque à l'appel, et c'est
 * exactement ce qui bloquait les decks de cérémonie sur leur spinner.
 *
 * Quatre gardes recopiaient la même ligne, dont trois se trompaient de prédicat :
 * la règle vit ici, et les appelants n'ont plus à s'en souvenir.
 */
export function anyLoading(queries: LoadableQuery[]): boolean {
  return queries.some((query) => query.isLoading)
}
