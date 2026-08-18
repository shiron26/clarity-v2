import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

// Pendant nu de `Input` : aucun label, aucun wrapper. Les écrans qui ont besoin
// d'un label visible l'assemblent eux-mêmes — la maquette de la modale
// d'objectif, elle, n'en a pas.
export function Textarea({ className, rows = 2, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        'w-full resize-none rounded-lg border-[1.5px] border-border bg-surface px-4 py-[14px]',
        'text-ui text-ink placeholder:text-placeholder',
        'transition-[border-color,box-shadow] duration-150',
        'outline-none focus:border-primary focus:ring-3 focus:ring-primary/14',
        className,
      )}
      {...rest}
    />
  )
}
