import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Largeur en pixels d'un élément, suivie via `ResizeObserver`.
 *
 * Utile quand la mise en page ne se déduit pas d'un breakpoint : la heatmap du
 * dashboard vit dans une grille qui passe à 2 puis 3 colonnes, si bien qu'un
 * écran *plus large* peut offrir *moins* de place à chaque carte. Seule la
 * largeur réelle du conteneur tranche.
 *
 * `useLayoutEffect` plutôt que `useEffect` : la première mesure tombe avant la
 * peinture, sans quoi l'appelant afficherait une frame trop large puis se
 * corrigerait — un clignotement visible.
 *
 * Renvoie `null` tant que rien n'a été mesuré (premier rendu, SSR) : à
 * l'appelant de choisir un repli, jamais de zéro déguisé en vraie mesure.
 */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number | null] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    setWidth(node.getBoundingClientRect().width)

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
