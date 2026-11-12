import type { SVGProps } from 'react'

/** Un gâteau à bougie : les anniversaires de « Ma journée ». */
export function CakeIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M4 21V13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" />
      <path d="M4 16c1.3 0 2-1 4-1s2.7 1 4 1 2-1 4-1 2.7 1 4 1" />
      <path d="M2.5 21h19" />
      <path d="M12 11V8" />
      <path d="M12 5.5c.9-.7 1-1.8 0-3-1 1.2-.9 2.3 0 3Z" />
    </svg>
  )
}
