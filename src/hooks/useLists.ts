// Listes perso + listes des espaces dont on est membre (le prédicat de la vue
// s'en charge). Servent au badge de liste sur les lignes de tâches.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export type List = {
  id: string
  user_id: string | null
  space_id: string | null
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
        .select('id, user_id, space_id, name, color, position')
        .order('position', { ascending: true })
      if (error) throw error
      return data as List[]
    },
  })
}
