import type { SVGProps } from 'react'

/**
 * La feuille du pense-bête : un coin replié, deux lignes écrites. Une punaise
 * aurait été plus imagée, mais à 16 px elle se lisait comme un stylo.
 */
export function NoteIcon({ className = 'size-4', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M14 3H6.6A1.6 1.6 0 0 0 5 4.6v14.8A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.6-1.6V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 12.5h7M8.5 16.5h4" />
    </svg>
  )
}
