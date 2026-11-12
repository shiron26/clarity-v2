import type { SVGProps } from 'react'

/** Une cloche : les notifications de « Ma journée ». */
export function BellIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.5 6.5 2.5 7.5h-17C4.5 16 6 14 6 9.5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  )
}
