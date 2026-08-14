import { useState } from 'react'
import { EyeIcon } from '../icons/EyeIcon'
import { EyeOffIcon } from '../icons/EyeOffIcon'
import { Field, type FieldProps } from './Field'

type PasswordFieldProps = Omit<FieldProps, 'type' | 'trailing'>

// Dérivé de Field : ajoute le bouton afficher/masquer, l'état vit ici.
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:text-ink-2 focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}
