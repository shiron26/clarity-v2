import { createContext, useContext } from 'react'

/**
 * Emplacement prêté par la coquille aux écrans, au-dessus de la zone qui défile.
 *
 * Même mécanique que `topBarSlot.ts`, et pour la même raison : le shell n'a pas
 * le droit de consommer le contexte d'une feature, donc il prête un nœud du DOM
 * et l'écran y envoie sa bannière par portail.
 *
 * Ce qui s'y rend est HORS du `<main>`, et c'est tout l'intérêt. Une bannière
 * `sticky` posée dans le `main` se heurte à son `padding` : le conteneur qui
 * défile en porte un, et une bande de fond restait visible au-dessus de la
 * barre dès qu'on faisait défiler la page. Rendue ici, elle occupe le haut de
 * la colonne sans marge négative, sans `z-index`, et le contenu ne passe pas
 * dessous : il commence en dessous.
 *
 * `null` tant que la coquille n'est pas montée — l'appelant ne rend rien alors.
 */
export const PageBannerSlotContext = createContext<HTMLElement | null>(null)

export function usePageBannerSlot(): HTMLElement | null {
  return useContext(PageBannerSlotContext)
}
