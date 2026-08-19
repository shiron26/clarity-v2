import type { SVGProps } from 'react'

/**
 * L'horizon : la ligne, et le soleil qui la coupe.
 *
 * L'année aurait pu porter `YearIcon`, mais posé à côté de `WeekIcon` dans la
 * palette, un calendrier en jouxtait un autre et les deux se confondaient. Les
 * icônes de période forment une famille exprès — c'est ce qu'il faut dans un
 * sélecteur de période, et l'inverse de ce qu'il faut dans une liste de widgets.
 */
export function HorizonIcon({ className = 'size-4', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M2.5 17.5h19" />
      <path d="M7.5 17.5a4.5 4.5 0 0 1 9 0" />
      <path d="M12 6v2M5.6 8.6l1.4 1.4M18.4 8.6 17 10" />
      <path d="M4 21h4M11 21h9" />
    </svg>
  )
}
