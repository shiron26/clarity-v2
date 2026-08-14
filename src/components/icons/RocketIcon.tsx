import type { SVGProps } from 'react'

type RocketIconProps = SVGProps<SVGSVGElement> & {
  /**
   * Ajoute le hublot. La grande fusée du flow de review le porte, la vignette
   * de 18 px de la grille des semaines non : à cette taille il boucherait le
   * fuselage au lieu de le détailler.
   */
  withPort?: boolean
}

/**
 * La fusée de l'échelle de review — pleine, colorée par `currentColor`.
 *
 * Seule icône de l'app en aplat : les autres sont au trait fin. C'est voulu,
 * c'est le marqueur de la métaphore de marque (SPEC §1).
 */
export function RocketIcon({ withPort = false, ...props }: RocketIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 1.5c3 2.6 4.6 6.2 4.6 9.8 0 1.5-.3 3-.8 4.4H8.2c-.5-1.4-.8-2.9-.8-4.4 0-3.6 1.6-7.2 4.6-9.8z" />
      {withPort && <circle cx="12" cy="9.2" r="1.9" fill="#101116" />}
      <path d="M8.6 16.6l-2.1 4.2 3.6-1.6 1.9 2.6 1.9-2.6 3.6 1.6-2.1-4.2z" />
    </svg>
  )
}
