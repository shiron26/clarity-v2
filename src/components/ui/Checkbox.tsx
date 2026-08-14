import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { CheckIcon } from '../icons/CheckIcon'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  label: ReactNode
  className?: string
}

// Vraie case native (clavier + lecteurs d'écran), pastille 18px dessinée par-dessus.
export function Checkbox({ label, className, ...inputProps }: CheckboxProps) {
  const id = useId()

  return (
    <div className={cn('flex items-center gap-[9px]', className)}>
      <input id={id} type="checkbox" className="peer sr-only" {...inputProps} />
      <label
        htmlFor={id}
        className={cn(
          'flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-xs',
          'border-[1.5px] border-border-idle bg-surface text-white',
          'transition-[background-color,border-color] duration-150',
          'peer-checked:border-primary peer-checked:bg-primary',
          'peer-focus-visible:ring-3 peer-focus-visible:ring-primary/32',
          // `peer-*` ne traverse pas le DOM : on cible l'icône depuis le label.
          'peer-checked:[&>svg]:opacity-100',
        )}
      >
        <CheckIcon className="size-3 opacity-0 transition-opacity duration-150" />
      </label>
      <label htmlFor={id} className="cursor-pointer text-body text-ink-2 select-none">
        {label}
      </label>
    </div>
  )
}
