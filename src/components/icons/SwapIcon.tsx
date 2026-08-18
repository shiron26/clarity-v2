import type { SVGProps } from 'react'

/**
 * Deux flèches opposées : « la nouvelle valeur remplace la précédente ».
 * Se lit par contraste avec `PlusIcon`, qui porte le cumul dans la même paire de
 * cartes.
 */
export function SwapIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M4 8h13M14 5l3 3-3 3" />
      <path d="M20 16H7M10 13l-3 3 3 3" />
    </svg>
  )
}
