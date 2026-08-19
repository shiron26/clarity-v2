import type { SVGProps } from 'react'

/**
 * La bannette du tri : un bac, et la fente par où les choses tombent dedans.
 * C'est la forme du tas — ce qui est écrit mais pas encore rangé.
 */
export function TrayIcon({ className = 'size-4', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4" />
      <path d="M6 4.5h12l2.5 9v4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-4Z" />
    </svg>
  )
}
