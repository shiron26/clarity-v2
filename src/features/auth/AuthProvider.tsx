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

// Le boot ne dépend du réseau que si le token stocké approche de l'expiration —
// sinon getSession() est une simple lecture de storage. Mais quand le serveur auth
// est injoignable, supabase-js retente le refresh en backoff (200, 400, 800… ms)
// tant que le cumul tient sous 30 s, et getSession() comme le premier événement
// attendent tous deux cette initialisation : sans borne, l'écran de garde de
// ProtectedRoute reste sur son spinner pendant ~25 s. Pire, un échec réseau est
// « retentable » côté supabase-js — la session est conservée et AUCUN événement
// n'est émis, donc rien ne viendrait nous détromper.
// Passé ce délai on tranche sans le serveur : signedOut, donc l'écran de connexion.
// L'événement auth fait autorité et corrigera s'il finit par arriver.
const BOOT_TIMEOUT_MS = 3_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', session: null })

  useEffect(() => {
    let cancelled = false
    // Un événement auth fait autorité : dès qu'il y en a eu un, ni la réponse
    // tardive de getSession() ni le garde-fou de délai ne doivent l'écraser.
    let settledByEvent = false

    // S'abonner AVANT getSession pour ne rater aucun événement.
    // Callback strictement synchrone : await d'un appel supabase ici = deadlock
    // (verrou interne de supabase-js).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear() // rien ne fuit d'un compte à l'autre
      }
      settledByEvent = true
      setState(fromSession(session))
    })

    // État initial — ne pas écraser un événement arrivé entre-temps
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled || settledByEvent) return
        setState(fromSession(session))
      })
      .catch((error: unknown) => {
        // getSession() renvoie normalement son échec dans `error` plutôt que de
        // rejeter ; on couvre quand même le cas, sinon la promesse rejetée
        // laisserait le boot au garde-fou sans la moindre trace en console.
        console.error('[auth] getSession', error)
      })

    // Garde-fou : voir BOOT_TIMEOUT_MS. Nettoyé au démontage — StrictMode
    // double-monte l'effet en dev.
    const timer = window.setTimeout(() => {
      if (cancelled || settledByEvent) return
      setState((prev) =>
        prev.status === 'loading' ? { status: 'signedOut', session: null } : prev,
      )
    }, BOOT_TIMEOUT_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
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
