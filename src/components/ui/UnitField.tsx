import { cn } from '../../lib/cn'
import { Input } from './Input'

/**
 * Un champ de valeur dont l'unité est un **suffixe fixe**, jamais retapé.
 *
 * Sur une quantité le suffixe suit le select d'unité ; sur une habitude il est
 * figé à « séances », parce qu'une habitude se compte en séances par
 * construction — c'est l'application qui compte, l'unité serait un choix sans
 * objet.
 *
 * Un suffixe vide disparaît : « sans unité » laisse un compteur nu.
 */
type UnitFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Chaîne vide = pas de suffixe affiché. */
  unit: string
  placeholder?: string
  ariaLabel?: string
  /** Le champ vient d'être révélé par un lien : il prend le focus. */
  autoFocus?: boolean
  className?: string
}

export function UnitField({
  id,
  value,
  onChange,
  unit,
  placeholder,
  ariaLabel,
  autoFocus = false,
  className,
}: UnitFieldProps) {
  return (
    <span className={cn('relative block', className)}>
      <Input
        id={id}
        // `inputMode` plutôt que `type="number"` : la saisie porte des espaces
        // de milliers et une virgule décimale (« 6 000 », « 3,5 »), qu'un champ
        // numérique refuserait silencieusement. `parseAmount` fait la lecture.
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={cn(unit !== '' && 'pr-14')}
      />
      {unit !== '' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-ui text-ink-3"
        >
          {unit}
        </span>
      )}
    </span>
  )
}
