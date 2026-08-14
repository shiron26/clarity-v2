// iOS n'a implémenté la media query `display-mode` que sur Safari 16.4 ; avant, la
// seule trace d'une app posée sur l'écran d'accueil est `navigator.standalone`, qui
// ne fait partie d'aucun standard. Cast ciblé plutôt que `any`.
type LegacyNavigator = Navigator & { standalone?: boolean }

/**
 * L'app tourne-t-elle en fenêtre installée plutôt que dans un onglet ?
 *
 * Volontairement relu à chaque appel (matchMedia est bon marché) : l'installation
 * peut survenir alors que l'app est déjà ouverte.
 */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
    return (window.navigator as LegacyNavigator).standalone === true
  } catch {
    // matchMedia indisponible : on reste sur l'hypothèse « onglet ordinaire ».
    return false
  }
}
