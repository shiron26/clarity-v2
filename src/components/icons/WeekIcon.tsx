import type { SVGProps } from 'react'

/**
 * Une semaine : le cadre de calendrier de `CalendarIcon`, avec **une seule
 * ligne** pleine. Se lit par contraste avec `MonthIcon`, qui porte la grille
 * entière — les deux ne servent qu'ensemble, dans le choix d'unité de période.
 */
export function WeekIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M7 15.5h10" />
    </svg>
  )
}
