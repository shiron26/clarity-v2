import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'

// Enregistre le service worker et propose la bascule quand une nouvelle version
// attend. `registerType: 'prompt'` la laisse en `waiting` : rien ne change sous les
// pieds de l'utilisateur tant qu'il n'a pas cliqué.
//
// Ni `Alert` ni `ErrorState` ne conviennent : `Alert` est une phrase inline sans
// action et son `role="alert"` est assertif (il coupe la parole au lecteur d'écran),
// or une mise à jour disponible est une information polie — d'où `role="status"`.
//
// Monté dans App et non dans AppShell : AppShell n'enveloppe que les routes
// authentifiées, or /login et /signup doivent aussi pouvoir se mettre à jour.
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Une app installée peut rester ouverte des jours ; le navigateur ne revérifie
    // sw.js qu'à la navigation (et toutes les 24 h). On sonde une fois par heure.
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    // Ancrée en haut : en bas elle recouvrirait la MobileTabBar et son FAB en
    // débord (-top-[22px]), c'est-à-dire la navigation elle-même.
    // `pointer-events-none` sur l'enveloppe pleine largeur, `auto` sur la pastille :
    // sinon la bande invisible intercepterait les clics sur la barre du haut.
    // z-90 : au-dessus de ObjectiveCelebration (z-80), le plus haut du dépôt.
    <div
      role="status"
      className="animate-fade-in pointer-events-none fixed inset-x-0 top-0 z-90 flex justify-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex w-full max-w-[460px] items-center gap-2 rounded-2xl bg-surface px-4 py-3 shadow-dropdown">
        <p className="min-w-0 flex-1 text-body text-ink-2">Une nouvelle version est disponible.</p>
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)} className="shrink-0">
          Plus tard
        </Button>
        {/* `updateServiceWorker` recharge la page elle-même (le client du plugin
            écoute `controlling`) : surtout pas de window.location.reload() ici,
            ce serait un double rechargement. */}
        <Button size="sm" onClick={() => void updateServiceWorker()} className="shrink-0">
          Actualiser
        </Button>
      </div>
    </div>
  )
}
