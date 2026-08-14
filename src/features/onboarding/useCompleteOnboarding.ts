// Marque la présentation comme vue. profile est une table claire : écriture
// directe, sans passer par viewWrites (réservé aux vues chiffrées).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from '../../lib/queryKeys'
import { useAuth } from '../auth/useAuth'

export function useCompleteOnboarding() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user.id

  return useMutation({
    mutationFn: async () => {
      if (!userId) return
      const { error } = await supabase
        .from('profile')
        .update({ onboarded_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all })
    },
  })
}
