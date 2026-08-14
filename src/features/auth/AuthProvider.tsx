import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { AuthContext, type AuthContextValue } from './AuthContext'

type State =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session }

function fromSession(session: Session | null): State {
  return session ? { status: 'signedIn', session } : { status: 'signedOut', session: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false

    // S'abonner AVANT getSession pour ne rater aucun événement.
    // Callback strictement synchrone : await d'un appel supabase ici = deadlock
    // (verrou interne de supabase-js).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear() // rien ne fuit d'un compte à l'autre
      }
      setState(fromSession(session))
    })

    // État initial — ne pas écraser un événement arrivé entre-temps
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setState((prev) => (prev.status === 'loading' ? fromSession(session) : prev))
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      session: state.session,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
