import { usePrivacy } from '../../hooks/usePrivacy'
import { cn } from '../../lib/cn'
import { EyeIcon } from '../icons/EyeIcon'
import { EyeOffIcon } from '../icons/EyeOffIcon'

/**
 * Le bouton « Masquer », dans la coquille et non dans un écran.
 *
 * Il agit partout (accueil, tâches, objectifs, année) : le laisser sur la barre
 * d'outils du dashboard obligeait à revenir sur l'accueil pour redonner leurs
 * titres aux objectifs, depuis un écran où ils étaient déjà masqués.
 *
 * Deux rendus derrière une variante plutôt que deux composants : la sidebar
 * aligne une rangée de navigation, la barre mobile n'a la place que d'une icône.
 */
export function PrivacyToggle({ variant }: { variant: 'sidebar' | 'icon' }) {
  const { privacy, toggle } = usePrivacy()
  const Icon = privacy ? EyeOffIcon : EyeIcon
  // Le titre dit l'effet de la prochaine frappe, pas l'état courant : c'est ce
  // que l'utilisateur cherche en survolant un interrupteur.
  const label = privacy ? 'Afficher les objectifs' : 'Masquer les objectifs'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={privacy}
        aria-label={label}
        title={label}
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors duration-150',
          'focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none',
          privacy ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:text-primary',
        )}
      >
        <Icon className="size-4" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={privacy}
      title={label}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-ui transition-colors duration-150',
        'outline-none focus-visible:ring-3 focus-visible:ring-primary/32',
        privacy
          ? 'bg-primary-soft font-medium text-primary'
          : 'text-ink-3 hover:bg-surface-subtle hover:text-ink',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {privacy ? 'Masqué' : 'Masquer'}
    </button>
  )
}
