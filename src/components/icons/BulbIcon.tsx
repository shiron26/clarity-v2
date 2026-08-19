import type { SVGProps } from 'react'

/**
 * L'ampoule des idées : le verre, le culot, et rien d'autre. Pas de rayons
 * autour — à 14 px ils font une tache, et l'idée se lit à la silhouette.
 */
export function BulbIcon({ className = 'size-4', ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M12 2.5a6 6 0 0 0-3.6 10.8c.6.4.9 1.1.9 1.8v.4h5.4v-.4c0-.7.3-1.4.9-1.8A6 6 0 0 0 12 2.5Z" />
      <path d="M9.3 18h5.4M10.4 21h3.2" />
    </svg>
  )
}
