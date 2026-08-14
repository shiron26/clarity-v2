import type { SVGProps } from 'react'

export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9.5 4.5H6a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 6 19.5h3.5" />
      <path d="M15 8.5 18.5 12 15 15.5" />
      <path d="M18.5 12h-9" />
    </svg>
  )
}
