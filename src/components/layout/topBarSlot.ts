import { createContext, useContext } from 'react'

/**
 * Emplacement prêté par la barre mobile aux écrans, à gauche de la déconnexion.
 *
 * `MobileTopBar` vit dans `AppShell`, au-dessus de l'`Outlet` : un écran ne peut
 * donc pas y glisser ses propres actions en les rendant normalement. Et la barre
 * ne peut pas les rendre elle-même — les boutons du dashboard lisent
 * `useDashboardLayout`, un contexte de feature, que le shell n'a pas le droit de
 * consommer (AGENTS.md). Le shell prête donc un nœud du DOM, et l'écran y
 * envoie ses boutons par portail : chacun garde ses dépendances.
 *
 * `null` tant que la barre n'est pas montée — l'appelant ne rend rien dans ce cas.
 */
export const TopBarSlotContext = createContext<HTMLElement | null>(null)

export function useTopBarSlot(): HTMLElement | null {
  return useContext(TopBarSlotContext)
}
