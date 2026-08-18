// La vue affichée et la liste sélectionnée vivent dans l'URL. Ce n'est pas de la
// persistance (la SPEC l'interdit) mais de l'**adressage** : c'est ce qui permet à
// la sidebar et à la barre d'onglets — des composants partagés — de piloter
// l'écran Tâches sans importer quoi que ce soit de la feature.
import type { TaskScope } from './taskScope'

// `?nouvelle=1` n'est plus ici : la modale de création est montée globalement et
// s'ouvre depuis trois features différentes — elle a son propre hook transverse,
// `src/hooks/useNewTask.ts`.
const VIEW_PARAM = 'vue'
const LIST_PARAM = 'liste'
const LISTS_PARAM = 'listes'

const VIEW_VALUES: Record<TaskScope, string> = {
  today: 'aujourdhui',
  week: 'semaine',
  undated: 'sans-date',
  all: 'toutes',
}

const VIEW_BY_VALUE = new Map(
  Object.entries(VIEW_VALUES).map(([scope, value]) => [value, scope as TaskScope]),
)

export type TaskParams = {
  scope: TaskScope
  /** La liste ouverte, s'il y en a une. Elle **restreint** la vue, elle ne la
   *  remplace pas : les deux paramètres se combinent. */
  listId: string | null
  listsOpen: boolean
}

export function parseTaskParams(params: URLSearchParams): TaskParams {
  return {
    scope: VIEW_BY_VALUE.get(params.get(VIEW_PARAM) ?? '') ?? 'today',
    listId: params.get(LIST_PARAM),
    listsOpen: params.get(LISTS_PARAM) === '1',
  }
}

/**
 * `?vue=semaine` — la chaîne à donner à un `Link`/`NavLink`. La liste courante
 * est reconduite : changer d'onglet depuis une liste filtre dedans, il n'en
 * fait pas sortir.
 */
export function scopeSearch(scope: TaskScope, listId?: string | null): string {
  const next = new URLSearchParams({ [VIEW_PARAM]: VIEW_VALUES[scope] })
  if (listId) next.set(LIST_PARAM, listId)
  return `?${next}`
}

/** `?liste=<uuid>` — sans `vue`, donc ouvrir une liste retombe sur « Aujourd'hui ». */
export function listSearch(listId: string): string {
  return `?${LIST_PARAM}=${encodeURIComponent(listId)}`
}

/** Ouvre « Gérer les listes » sans quitter la vue courante. */
export function withLists(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set(LISTS_PARAM, '1')
  return next
}

/**
 * Referme « Gérer les listes » sans toucher à la vue courante. À utiliser avec
 * `{ replace: true }` : la fermeture d'une modale n'est pas une navigation.
 */
export function withoutLists(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(LISTS_PARAM)
  return next
}
