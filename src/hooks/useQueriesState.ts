// L'état agrégé des queries d'un écran : y a-t-il une erreur à MONTRER, et que
// relancer quand l'utilisateur clique « Réessayer » ?
//
// Six écrans portaient la même quinzaine de lignes — dont deux qui redéclaraient
// `QueryLike` **dans leur corps de fonction**. La politique « ne relancer que ce
// qui a échoué » (les queries saines gardent leur cache) vit ici, en un seul
// endroit modifiable.
//
// La règle centrale de ce fichier, apprise d'un bandeau qui restait collé après
// une nuit : **un écran qui a des données à afficher ne crie pas**. TanStack
// conserve `data` quand un rafraîchissement en arrière-plan échoue et passe
// quand même `status: 'error'` ; tester `error !== null` faisait donc rendre un
// bloc rouge « Impossible de charger ces données » par-dessus un écran complet,
// que rien ne pouvait effacer sans recharger la page. Une panne de liaison est
// un état de l'application (`SyncBanner`), pas un contenu d'écran.
import { isTerminalError } from '../lib/queryError'

/**
 * Type **structurel** : les `UseQueryResult<T>` n'ont pas de type nominal commun
 * — leur paramètre de données diffère d'une query à l'autre — et on n'a besoin
 * ici que de ces quatre membres.
 *
 * `isLoadingError` est fourni par TanStack et dit exactement ce qui nous
 * intéresse : en erreur ET sans donnée à afficher.
 */
export type QueryLike = {
  error: Error | null
  isLoadingError: boolean
  isFetching: boolean
  refetch: () => Promise<unknown>
}

export type QueriesState = {
  /** L'erreur à afficher, ou `null` s'il n'y a rien à dire à l'écran. */
  firstError: Error | null
  retrying: boolean
  onRetry: () => void
}

/**
 * Une erreur se montre dans deux cas, et deux seulement :
 *
 *  - **il n'y a rien à afficher** (`isLoadingError`) : l'écran serait vide, il
 *    faut bien dire pourquoi ;
 *  - **l'erreur est terminale** (droits, donnée disparue, conflit, règle métier) :
 *    elle ne passera pas toute seule, et elle a une copie qui dit quoi faire.
 *
 * Le reste — un refetch qui rate par-dessus des données déjà à l'écran — part
 * dans l'état de liaison et se répare tout seul.
 *
 * Fonction pure, testée à part : c'est la décision, pas le câblage.
 */
export function selectErrorState(
  queries: QueryLike[],
  extraError?: Error | null,
): QueriesState {
  const failed = queries.filter((query) => query.error !== null)
  const shown = failed.find(
    (query) => query.isLoadingError || isTerminalError(query.error),
  )

  return {
    firstError: shown?.error ?? extraError ?? null,
    // Toutes les queries en échec se relancent, y compris celles qui ne
    // s'affichent pas : le bouton répare l'écran entier, pas seulement ce qui
    // se voit.
    retrying: failed.some((query) => query.isFetching),
    onRetry: () => {
      for (const query of failed) void query.refetch()
    },
  }
}

/**
 * `extraError` ne couvre plus qu'un seul cas, et c'est le bon : une **mutation**
 * en échec (l'ouverture d'un bilan), qu'aucun refetch ne peut relancer.
 *
 * Les hooks composites, eux, exposent désormais leurs queries (voir
 * `usePendingBilan`) : passer leur erreur agrégée ici la rendait **impossible à
 * retenter**, et c'est précisément ce qui obligeait à recharger la page.
 */
export function useQueriesState(queries: QueryLike[], extraError?: Error | null) {
  return selectErrorState(queries, extraError)
}

/**
 * La même règle pour un bloc qui n'a pas de bouton « Réessayer » : un widget du
 * dashboard ne remplace son contenu par un bloc d'erreur que s'il n'a rien à
 * montrer, ou si l'erreur est terminale.
 */
export function firstLoadError(...queries: QueryLike[]): Error | null {
  return selectErrorState(queries).firstError
}
