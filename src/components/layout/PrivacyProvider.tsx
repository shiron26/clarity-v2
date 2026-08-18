import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { PrivacyContext, type PrivacyValue } from '../../hooks/usePrivacy'
import { readPrivacy, writePrivacy } from '../../lib/privacyStorage'

/**
 * Porte le mode masqué pour toute la coquille (`AppShell`). Monté au-dessus de
 * l'`Outlet` : tous les écrans authentifiés lisent le même booléen, et changer
 * de page ne le perd pas.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  // Lecture paresseuse : un seul accès au localStorage au montage.
  const [privacy, setPrivacy] = useState(() => (userId ? readPrivacy(userId) : false))

  const toggle = useCallback(() => {
    setPrivacy((current) => {
      const next = !current
      if (userId) writePrivacy(userId, next)
      return next
    })
  }, [userId])

  const value = useMemo<PrivacyValue>(() => ({ privacy, toggle }), [privacy, toggle])

  return <PrivacyContext value={value}>{children}</PrivacyContext>
}
