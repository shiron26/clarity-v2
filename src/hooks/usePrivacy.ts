import { createContext, useContext } from 'react'

/**
 * Le mode « masqué » : le regard par-dessus l'épaule.
 *
 * Il vaut pour **toute l'application**, pas pour un écran. Quelqu'un qui masque
 * ses objectifs dans un open space ne les masque pas « sur l'accueil » : il ne
 * veut pas qu'ils se lisent, où qu'ils s'affichent. C'est ce qui l'a sorti des
 * disposition du dashboard (`dashboardLayout.ts`, qui ne pilote que la
 * présence de blocs sur un seul écran) pour devenir un état de la coquille.
 *
 * Client-only, comme les préférences de dashboard : rien ne remonte en base,
 * c'est du state client et non du server state.
 */
export type PrivacyValue = {
  /** Les titres d'objectifs et de jalons sont remplacés par des points. */
  privacy: boolean
  toggle: () => void
}

export const PrivacyContext = createContext<PrivacyValue | null>(null)

export function usePrivacy(): PrivacyValue {
  const value = useContext(PrivacyContext)
  if (!value) throw new Error('usePrivacy doit être utilisé sous <PrivacyProvider>')
  return value
}
