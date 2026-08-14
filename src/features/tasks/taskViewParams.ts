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

const VIEW_VALUES: Record<Exclude<TaskScope, 'list'>, string> = {
  today: 'aujourdhui',
  tomorrow: 'demain',
  week: 'semaine',
  all: 'toutes',
}

const VIEW_BY_VALUE = new Map(
  Object.entries(VIEW_VALUES).map(([scope, value]) => [value, scope as Exclude<TaskScope, 'list'>]),
)

export type TaskParams = {
  scope: TaskScope
  /** Renseigné seulement quand `scope === 'list'`. */
  listId: string | null
  listsOpen: boolean
}

export function parseTaskParams(params: URLSearchParams): TaskParams {
  const listId = params.get(LIST_PARAM)
  const view = params.get(VIEW_PARAM)
  const scope: TaskScope = listId ? 'list' : (VIEW_BY_VALUE.get(view ?? '') ?? 'today')

  return {
    scope,
    listId: scope === 'list' ? listId : null,
    listsOpen: params.get(LISTS_PARAM) === '1',
  }
}

/** `?vue=semaine` — la chaîne à donner à un `Link`/`NavLink`. */
export function scopeSearch(scope: Exclude<TaskScope, 'list'>): string {
  return `?${VIEW_PARAM}=${VIEW_VALUES[scope]}`
}

/** `?liste=<uuid>` */
export function listSearch(listId: string): string {
  return `?${LIST_PARAM}=${encodeURIComponent(listId)}`
}

/** `?listes=1` — ouvre « Gérer les listes » depuis n'importe où. */
export const MANAGE_LISTS_SEARCH = `?${LISTS_PARAM}=1`

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
