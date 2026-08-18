import type { Ref } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { useProfile } from '../../hooks/useProfile'
import { Logo } from '../brand/Logo'
import { LogoutIcon } from '../icons/LogoutIcon'
import { Avatar } from '../ui/Avatar'
import { PrivacyToggle } from './PrivacyToggle'

type MobileTopBarProps = {
  /** Reçoit le nœud où les écrans envoient leurs actions — voir `topBarSlot.ts`. */
  actionsRef?: Ref<HTMLDivElement>
}

export function MobileTopBar({ actionsRef }: MobileTopBarProps) {
  const { signOut } = useAuth()
  const profile = useProfile()

  return (
    // pt : 1.375rem d'origine + la zone sûre du haut (encoche / Dynamic Island).
    <header className="flex shrink-0 items-center gap-2.5 px-5 pt-[calc(1.375rem+env(safe-area-inset-top))] pb-3 lg:hidden">
      <Logo size="sm" />
      <div className="ml-auto flex items-center gap-2">
        {/* Actions de l'écran courant, avant la déconnexion : les remonter ici
            épargne une pleine ligne de barre d'outils sous le logo. */}
        <div ref={actionsRef} className="flex items-center gap-1" />

        {/* Après les actions d'écran, avant la déconnexion : comme elle, il vaut
            pour l'application entière et non pour la page ouverte. */}
        <PrivacyToggle variant="icon" />

        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Se déconnecter"
          className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-ink-muted transition-colors duration-150 hover:bg-danger-bg hover:text-danger focus-visible:ring-3 focus-visible:ring-primary/32 focus-visible:outline-none"
        >
          <LogoutIcon />
        </button>
        <Avatar name={profile.data?.display_name} />
      </div>
    </header>
  )
}
