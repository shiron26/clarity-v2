import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip, TooltipLines } from './Tooltip'

type TooltipIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  /** Le nom de l'action. Sert d'`aria-label` ET de première ligne de l'infobulle. */
  label: string
  /** Ce que l'action fait vraiment, quand le nom ne suffit pas : conséquence, limite. */
  hint?: string
  children: ReactNode
}

/**
 * Un bouton réduit à son icône, dont le sens vit dans une infobulle.
 *
 * Là où `IconButton` s'appuie sur l'attribut `title` du navigateur, celui-ci
 * ouvre une vraie infobulle : elle apparaît vite, elle se met en forme, elle
 * s'ouvre aussi au clavier. C'est ce qui rend une barre d'actions sans texte
 * acceptable — une icône seule sans moyen d'en connaître le sens ne l'est pas.
 *
 * D'où les DEUX lignes : le nom de l'action, et la conséquence qu'on ne peut pas
 * dessiner (« les tâches partagées ne bougent pas »). Le nom seul redirait
 * l'icône ; c'est le reste qui justifie l'infobulle.
 *
 * À réserver aux actions SECONDAIRES d'une barre. Une action principale garde
 * son libellé : une icône qu'il faut survoler pour comprendre n'est pas un
 * point d'entrée, et au doigt il n'y a pas de survol du tout.
 *
 * Piège Radix : un bouton `disabled` ne reçoit pas d'évènement de pointeur, donc
 * son infobulle ne s'ouvre pas. Acceptable ici — la désactivation ne dure que le
 * temps d'une mutation.
 */
export function TooltipIconButton({
  label,
  hint,
  className,
  type = 'button',
  children,
  ...rest
}: TooltipIconButtonProps) {
  return (
    <Tooltip content={<TooltipLines title={label} hint={hint} />}>
      <button
        type={type}
        aria-label={label}
        className={cn(
          'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md',
          'bg-field text-ink-2 transition-colors duration-150',
          'hover:bg-border hover:text-ink',
          'active:translate-y-px',
          'outline-none focus-visible:ring-3 focus-visible:ring-primary/32',
          'disabled:cursor-default disabled:opacity-60',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  )
}
