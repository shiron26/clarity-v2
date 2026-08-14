import type { SVGProps } from 'react'

export function SearchIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  )
}
