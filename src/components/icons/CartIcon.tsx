import type { SVGProps } from 'react'

/**
 * Le caddie : la anse, la nacelle, les deux roues. Un panier suffisait à dire
 * « courses », mais à 18 px il ne se distinguait pas d'une corbeille ni d'une
 * bannette — les roues, elles, n'appartiennent qu'au caddie.
 */
export function CartIcon({ className = 'size-4', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M2.5 3.5h2.3l2.5 11a1.8 1.8 0 0 0 1.7 1.4h8.2a1.8 1.8 0 0 0 1.7-1.3L20.5 8H6" />
      <circle cx="9.5" cy="20" r="1.5" />
      <circle cx="17.5" cy="20" r="1.5" />
    </svg>
  )
}
