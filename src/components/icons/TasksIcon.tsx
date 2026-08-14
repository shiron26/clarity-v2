import type { SVGProps } from 'react'

export function TasksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 6h11M9 12h11M9 18h8" />
      <path d="M3.5 5.5l1 1 1.8-2.2M3.5 11.5l1 1 1.8-2.2" />
      <circle cx="4.5" cy="18" r="1.6" />
    </svg>
  )
}
