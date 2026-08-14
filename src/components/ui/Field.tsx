import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Input, type InputTone } from './Input'

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  tone?: InputTone
  /** Message d'erreur sous le champ — pose aussi aria-invalid. */
  error?: string | null
  /** Contenu discret sous le champ quand il n'y a pas d'erreur. */
  hint?: ReactNode
  /** Élément superposé à droite dans le champ (bouton œil…). */
  trailing?: ReactNode
  /** Bloc libre rendu sous le champ (jauge de force…). */
  footer?: ReactNode
  className?: string
  inputClassName?: string
}

export function Field({
  label,
  tone = 'default',
  error,
  hint,
  trailing,
  footer,
  className,
  inputClassName,
  ...inputProps
}: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint

  return (
    <div className={cn('flex flex-col gap-[7px]', className)}>
      <label htmlFor={id} className="text-label font-medium text-ink-2">
        {label}
      </label>

      <div className={cn(trailing && 'relative flex items-center')}>
        <Input
          id={id}
          tone={error ? 'ko' : tone}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(trailing && 'pr-12', inputClassName)}
          {...inputProps}
        />
        {trailing && <span className="absolute right-2 flex items-center">{trailing}</span>}
      </div>

      {footer}

      {message && (
        <span
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn('text-[11px]', error ? 'text-danger' : 'text-ink-muted')}
        >
          {message}
        </span>
      )}
    </div>
  )
}
