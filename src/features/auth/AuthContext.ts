import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthContextValue {
  status: AuthStatus
  /** non-null ssi status === 'signedIn' */
  session: Session | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
