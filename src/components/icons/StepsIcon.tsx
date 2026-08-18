import type { SVGProps } from 'react'

/**
 * Des étapes : un escalier qui monte. Le seul des trois glyphes de mesure qui ne
 * parle ni de rythme ni de valeur — on franchit des marches, une à une, et il
 * n'y a rien à répéter ni à relever.
 */
export function StepsIcon({ className = 'size-3.5', ...rest }: SVGProps<SVGSVGElement>) {
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
      <path d="M3 19h5v-5h5V9h5V4h3" />
    </svg>
  )
}
