// Listes perso + listes des espaces dont on est membre (le prédicat de la vue
// s'en charge). Servent au badge de liste sur les lignes de tâches.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

/**
 * Nature d'une liste. « task » est une liste ordinaire, visible dans l'écran
 * Tâches ; les trois autres sont les aide-mémoire du dashboard (Courses, Idées,
 * Pense-bête), semés par le serveur à l'inscription et rendus par leur widget.
 * Les listes d'aide-mémoire portent de vraies tâches — elles n'ont simplement
 * pas leur place dans un écran fait pour ce qui a une échéance.
 */
export type ListKind = 'task' | 'courses' | 'idees' | 'notes'

export type List = {
  id: string
  user_id: string | null
  space_id: string | null
  kind: ListKind
  name: string
  color: string | null
  position: number
}

export function useLists() {
  const { status } = useAuth()

  return useQuery({
    queryKey: queryKeys.list.all,
    enabled: status === 'signedIn',
    queryFn: async (): Promise<List[]> => {
      const { data, error } = await supabase
        .from('list')
        .select('id, user_id, space_id, kind, name, color, position')
        .order('position', { ascending: true })
      if (error) throw error
      return data as List[]
    },
  })
}

/**
 * Les listes de l'écran Tâches. Le filtre vit ici et chez les appelants, jamais
 * dans la query : le widget d'aide-mémoire a besoin, lui, des listes que cet
 * écran écarte.
 */
export function selectTaskLists(lists: List[] | undefined): List[] {
  return (lists ?? []).filter((list) => list.kind === 'task')
}

/** Les aide-mémoire, dans l'ordre où le serveur les a semés. */
export function selectMemoLists(lists: List[] | undefined): List[] {
  return (lists ?? []).filter((list) => list.kind !== 'task')
}

/** L'aide-mémoire d'une nature donnée, s'il existe encore. */
export function findMemoList(lists: List[] | undefined, kind: ListKind): List | undefined {
  return (lists ?? []).find((list) => list.kind === kind)
}
