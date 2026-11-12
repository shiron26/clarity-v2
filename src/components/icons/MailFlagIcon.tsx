import type { SVGProps } from 'react'

/**
 * L'enveloppe de `MailIcon`, entaillée d'une pastille pleine : un mail marqué
 * important. Se lit par contraste avec l'enveloppe nue des « Autres mails ».
 */
export function MailFlagIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M15 4.5H5.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3V11" />
      <path d="m3.5 7.5 7.3 5.2a2 2 0 0 0 2.4 0l1.8-1.3" />
      <circle cx="19.5" cy="5.5" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
