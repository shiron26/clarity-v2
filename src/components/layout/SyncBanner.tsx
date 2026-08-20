import { useSyncStatus } from '../../hooks/useSyncStatus'
import { cn } from '../../lib/cn'

// La seule surface de l'application qui parle de réseau.
//
// Avant, chaque écran traduisait sa propre panne en bloc rouge « Impossible de
// charger ces données », posé par-dessus un écran par ailleurs complet et
// utilisable. Une liaison qui tombe n'est pas un contenu d'écran, c'est un état
// de l'application : une pastille sobre, une fois, et rien du reste du temps.
//
// Même famille visuelle et mêmes contraintes qu'`UpdateBanner`, pour les mêmes
// raisons : `role="status"` (poli, il ne coupe pas la parole au lecteur d'écran
// comme le ferait `role="alert"`), ancrée en haut pour ne pas recouvrir la
// MobileTabBar et son FAB en débord, `pointer-events-none` sur l'enveloppe pleine
// largeur pour ne pas intercepter les clics de la barre du haut.
export function SyncBanner() {
  const status = useSyncStatus()

  if (status === 'ok') return null

  return (
    <div
      role="status"
      className="animate-fade-in pointer-events-none fixed inset-x-0 top-0 z-90 flex justify-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex max-w-[460px] items-center gap-2 rounded-2xl bg-surface px-4 py-2.5 shadow-dropdown">
        {/* La PHRASE ne change pas entre `syncing` et `offline`, seul le point
            bouge. Les deux états alternent plusieurs fois pendant la fenêtre de
            tentatives (huit queries, des délais tirés au hasard) : deux textes
            qui se remplacent clignoteraient. Le point qui bat dit « ça retente »
            sans rien faire sauter. */}
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full bg-danger',
            status === 'syncing' && 'animate-pulse',
          )}
        />
        <p className="min-w-0 text-label text-ink-2">
          Hors ligne. L’écran se remettra à jour tout seul.
        </p>
      </div>
    </div>
  )
}
