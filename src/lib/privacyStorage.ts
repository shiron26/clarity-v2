// Persistance du mode masqué. Clé par utilisateur : deux comptes sur le même
// navigateur ne partagent pas leur réglage, et « masquer » ne fuite pas de l'un
// à l'autre.

function storageKey(userId: string): string {
  return `clarity.privacy.${userId}`
}

/** L'ancien logement du réglage, avant qu'il ne devienne applicatif. */
function legacyKey(userId: string): string {
  return `clarity.dashboard.${userId}`
}

export function readPrivacy(userId: string): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (raw !== null) return raw === '1'
    // Reprise de l'ancienne valeur : « masqué » est le seul réglage dont l'oubli
    // se paie en révélant ce qu'on voulait cacher. Elle n'est lue qu'une fois,
    // le premier basculement écrit la nouvelle clé.
    const legacy = window.localStorage.getItem(legacyKey(userId))
    if (!legacy) return false
    return (JSON.parse(legacy) as { privacy?: unknown }).privacy === true
  } catch {
    return false
  }
}

export function writePrivacy(userId: string, privacy: boolean): void {
  try {
    window.localStorage.setItem(storageKey(userId), privacy ? '1' : '0')
  } catch {
    // Stockage indisponible : le réglage reste valable pour la session.
  }
}
