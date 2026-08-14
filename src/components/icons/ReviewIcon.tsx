import type { SVGProps } from 'react'

export function ReviewIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 16l5-5 4 4 7-8" />
      <path d="M15 6.5h5v5" />
    </svg>
  )
}
