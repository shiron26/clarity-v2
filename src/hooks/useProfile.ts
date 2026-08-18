// Premier hook query du produit — matérialise les conventions :
// key via la fabrique, `enabled` sur la session, throw de l'erreur PostgREST
// dans le queryFn (le client supabase ne throw pas), typage inféré du client.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: queryKeys.profile.detail(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile')
        .select('id, display_name, onboarded_at')
        .eq('id', userId!)
        .single()
      if (error) throw error
      // Confort de dev : rejoue l'onboarding à chaque chargement sans recréer un
      // compte. `import.meta.env.DEV` fige la condition à false au build — le
      // drapeau ne peut pas s'activer en prod, même défini sur Vercel.
      if (import.meta.env.DEV && import.meta.env.VITE_FORCE_ONBOARDING === '1') {
        return { ...data, onboarded_at: null }
      }
      return data
    },
  })
}
