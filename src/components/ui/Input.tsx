import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type InputTone = 'default' | 'ok' | 'ko'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  tone?: InputTone
}

const TONES: Record<InputTone, string> = {
  default: 'border-border',
  ok: 'border-border-ok',
  ko: 'border-border-ko',
}

export function Input({ tone = 'default', className, type = 'text', ...rest }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'w-full rounded-lg border-[1.5px] bg-surface px-4 py-[14px]',
        'text-ui text-ink placeholder:text-placeholder',
        'transition-[border-color,box-shadow] duration-150',
        'outline-none focus:border-primary focus:ring-3 focus:ring-primary/14',
        'disabled:bg-surface-subtle disabled:text-ink-muted',
        TONES[tone],
        className,
      )}
      {...rest}
    />
  )
}
