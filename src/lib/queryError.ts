// Classement des erreurs remontées par PostgREST, GoTrue et le transport.
//
// Deux pièges de forme dictent tout ce fichier, vérifiés dans postgrest-js :
//
//  1. Le pattern `const { data, error } = await …; if (error) throw error` throw
//     un OBJET NU `{ message, details, hint, code }` — jamais une instance de
//     `PostgrestError` (elle n'est construite que sous `shouldThrowOnError`,
//     qu'on n'active pas). Donc pas d'`instanceof` : on classe structurellement.
//  2. Le status HTTP est un champ frère de `error` dans la réponse, il n'arrive
//     jamais jusqu'ici. Seul GoTrue pose un `status` sur ses erreurs.
//
// Et une conséquence contre-intuitive : sur panne réseau, postgrest-js renvoie
// `code: ''` (chaîne vide), pas `undefined`. Tout prédicat du genre
// `typeof code === 'string'` classe donc l'offline avec les erreurs métier.

export type ErrorKind =
  /** 401 PGRST301 : JWT non vérifiable à l'instant T. RETENTABLE — voir plus bas. */
  | 'authTransient'
  /** Session réellement morte ou absente : seule une reconnexion débloque. */
  | 'authGone'
  /** Pas de réponse du serveur. RETENTABLE. */
  | 'offline'
  /** RLS / privilèges : la requête ne passera jamais telle quelle. */
  | 'permission'
  /** `.single()` sans ligne. */
  | 'notFound'
  /** Contrainte violée (unicité, clé étrangère, check). */
  | 'conflict'
  | 'unknown'

type ErrorShape = { code?: unknown; status?: unknown; message?: unknown }

function shapeOf(error: unknown): ErrorShape {
  return typeof error === 'object' && error !== null ? (error as ErrorShape) : {}
}

/** Code applicatif : `PGRST…` (PostgREST), SQLSTATE (`42501`), ou code GoTrue. */
export function errorCode(error: unknown): string | null {
  const { code } = shapeOf(error)
  return typeof code === 'string' && code.length > 0 ? code : null
}

/**
 * Message brut du serveur. À n'utiliser QUE pour reconnaître une règle métier
 * (les exceptions PL/pgSQL n'ont pas d'errcode distinct) — jamais pour affichage.
 */
export function errorMessageText(error: unknown): string | null {
  const { message } = shapeOf(error)
  return typeof message === 'string' && message.length > 0 ? message : null
}

/** Status HTTP — présent sur les erreurs GoTrue uniquement. */
export function errorStatus(error: unknown): number | null {
  const { status } = shapeOf(error)
  return typeof status === 'number' ? status : null
}

function isTransportFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true
  // L'objet postgrest-js d'échec réseau : code vide + message préfixé du nom de
  // l'erreur fetch. C'est le seul signal disponible, d'où le regex ancré.
  const { code, message } = shapeOf(error)
  return code === '' && typeof message === 'string' && /^(TypeError|FetchError|AbortError)/.test(message)
}

export function classifyError(error: unknown): ErrorKind {
  if (isTransportFailure(error)) return 'offline'

  switch (errorCode(error)) {
    // PostgREST renvoie PGRST301 pour tout échec de vérification du JWT, dont
    // le cas qui nous occupe : `iat` dans le futur. GoTrue signe avec l'instant
    // présent tronqué à la seconde ; si l'horloge du vérifieur retarde
    // marginalement, les toutes premières requêtes suivant un signup/signin
    // sont rejetées ~1 s, puis le token « vieillit » dans la validité.
    // Retentable, et le retry se suffit à lui-même : supabase-js re-résout le
    // bearer à chaque tentative (fetchWithAuth → auth.getSession()), ce qui
    // rafraîchit aussi tout seul le cas voisin d'un token réellement expiré.
    case 'PGRST301':
      return 'authTransient'
    // Aucun JWT présenté : retenter à l'identique ne changera rien.
    case 'PGRST302':
      return 'authGone'
    case 'session_expired':
    case 'refresh_token_not_found':
      return 'authGone'
    case '42501':
      return 'permission'
    case 'PGRST116':
      return 'notFound'
    case '23505':
    case '23503':
    case '23514':
      return 'conflict'
  }

  const status = errorStatus(error)
  if (status === 401 || status === 403) return 'authGone'

  return 'unknown'
}

export function isRetryableKind(kind: ErrorKind): boolean {
  return kind === 'authTransient' || kind === 'offline'
}
