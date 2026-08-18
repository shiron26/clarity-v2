import type { SVGProps } from 'react'

/**
 * Un trimestre : le cercle de l'année, avec **son quart rempli**. T1 en haut à
 * droite, puis dans le sens des aiguilles — la position du quart dit lequel des
 * quatre on regarde, sans lire le titre.
 *
 * Les quatre cartes de l'écran Année se ressemblaient trait pour trait ; c'est la
 * seule chose qui les distinguait vraiment, et elle n'était écrite qu'en toutes
 * lettres.
 */
const WEDGES: Record<number, string> = {
  1: 'M12 12V3a9 9 0 0 1 9 9z',
  2: 'M12 12h9a9 9 0 0 1-9 9z',
  3: 'M12 12v9a9 9 0 0 1-9-9z',
  4: 'M12 12H3a9 9 0 0 1 9-9z',
}

type QuarterIconProps = SVGProps<SVGSVGElement> & {
  /** 1 à 4. Hors bornes, aucun quart n'est rempli. */
  quarter: number
}

export function QuarterIcon({ quarter, className = 'size-3.5', ...rest }: QuarterIconProps) {
  const wedge = WEDGES[quarter]

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <circle cx="12" cy="12" r="9" />
      {wedge && <path d={wedge} fill="currentColor" stroke="none" />}
    </svg>
  )
}
