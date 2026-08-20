import type { SVGProps } from 'react'

/** Un calendrier et une flèche : reporter une échéance vers l'avant. */
export function CalendarArrowIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M8 15.5h7M12.5 13l2.5 2.5-2.5 2.5" />
    </svg>
  )
}
