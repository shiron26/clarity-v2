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
// Et une conséquence contre-intuitive, qui est aussi le signal le plus utile du
// fichier : quand le fetch n'aboutit pas, postgrest-js renvoie `code: ''`
// (chaîne VIDE), là où une erreur venue d'une réponse HTTP porte un vrai code ou
// pas de champ `code` du tout. Vide et absent ne veulent donc pas dire la même
// chose, et tout prédicat du genre `typeof code === 'string'` mélange les deux.

export type ErrorKind =
  /** 401 PGRST301 : JWT non vérifiable à l'instant T. TRANSITOIRE — voir plus bas. */
  | 'authTransient'
  /** Session réellement morte ou absente : seule une reconnexion débloque. */
  | 'authGone'
  /** Le fetch n'a jamais abouti : réseau, CORS, annulation, ou échec de résolution du jeton. */
  | 'offline'
  /** RLS / privilèges : la requête ne passera jamais telle quelle. */
  | 'permission'
  /** `.single()` sans ligne. */
  | 'notFound'
  /** Contrainte violée (unicité, clé étrangère, check, exclusion). */
  | 'conflict'
  /** Exception PL/pgSQL d'un trigger : une règle du produit, pas une panne. */
  | 'businessRule'
  /** Réponse du serveur qu'on ne sait pas nommer — dont les 5xx et les corps non-JSON. */
  | 'unknown'

type ErrorShape = { code?: unknown; status?: unknown; message?: unknown; name?: unknown }

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
function errorStatus(error: unknown): number | null {
  const { status } = shapeOf(error)
  return typeof status === 'number' ? status : null
}

/**
 * Le fetch n'a pas abouti : la requête n'a jamais atteint PostgREST.
 *
 * Le signal est `code === ''`, et il est EXACT. postgrest-js pose cette chaîne
 * vide dans le seul `catch` qui entoure son appel à fetch ; toute erreur
 * construite depuis une réponse HTTP porte soit le code renvoyé par la base,
 * soit aucun champ `code`.
 *
 * Le test portait avant sur le message (`/^(TypeError|FetchError|AbortError)/`),
 * qui n'en était qu'une approximation : postgrest-js compose ce message avec
 * `${fetchError.name ?? 'FetchError'}: …`, et le fetch de supabase-js résout le
 * jeton AVANT de partir (`fetchWithAuth` fait `await getAccessToken()`). Toute
 * la famille des erreurs d'auth jetées pendant ce renouvellement porte donc un
 * autre `name` — elles tombaient en `unknown`, c'est-à-dire en « une erreur est
 * survenue de notre côté », et n'étaient jamais retentées.
 */
function isTransportFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true
  const { code, name } = shapeOf(error)
  // GoTrue, lui, emballe la panne réseau dans une `AuthRetryableFetchError` :
  // `code` absent, `status: 0` — seul le `name` la distingue d'une erreur
  // applicative. Sans ce test elle tombe en `unknown` et les pages auth
  // affichent la copie générique au lieu de la copie offline. La même classe
  // couvre les 502/503/504 de GoTrue : « connexion au serveur impossible »
  // reste vrai dans ce cas.
  if (name === 'AuthRetryableFetchError') return true
  return code === ''
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
    // Contrainte d'EXCLUSION : depuis que les slots sont uniques par
    // chevauchement de fenêtre, une collision remonte en 23P01 et non plus en
    // 23505. Sans ce cas, elle tomberait en `unknown` — donc en « une erreur est
    // survenue de notre côté » alors que c'est un conflit de données.
    case '23P01':
      return 'conflict'
    // Toute règle métier d'un trigger arrive ici : `raise exception` sans
    // errcode donne P0001, et seule la chaîne du message les distingue (c'est
    // `errorMessage.ts` qui la traduit). Le classement, lui, n'a qu'à savoir
    // que ce n'est pas une panne : ça ne se retente pas.
    case 'P0001':
      return 'businessRule'
  }

  const status = errorStatus(error)
  if (status === 401 || status === 403) return 'authGone'

  return 'unknown'
}

/**
 * Une erreur terminale ne passera pas mieux à la deuxième tentative.
 *
 * C'est la liste des EXCEPTIONS, et c'est voulu dans ce sens : la politique
 * inverse (une liste blanche du retentable) laissait le fourre-tout `unknown`
 * sans aucune tentative, et un hoquet de passerelle au réveil de l'onglet se
 * figeait définitivement à l'écran. Un 502, un redémarrage de PostgREST ou un
 * statement timeout ne sont pas des erreurs de l'utilisateur : ils se retentent.
 */
export function isTerminalError(error: unknown): boolean {
  switch (classifyError(error)) {
    case 'authGone':
    case 'permission':
    case 'notFound':
    case 'conflict':
    case 'businessRule':
      return true
    case 'authTransient':
    case 'offline':
    case 'unknown':
      break
  }

  // Requête malformée (PGRST1xx) ou cache de schéma (PGRST2xx) : un bug de notre
  // côté, pas un hoquet. Trois tentatives de plus ne feraient qu'ajouter du
  // délai avant d'afficher le message.
  const code = errorCode(error)
  return code !== null && /^PGRST[12]/.test(code)
}

/**
 * La politique de retry des **mutations** : seul un `PGRST301` transitoire se
 * retente, et trois fois au plus.
 *
 * Ici et non dans chaque fichier de mutations : quatre hooks la portaient, deux
 * en constante et deux en lambda inline. C'est aussi le module qui décide ce
 * qu'est un `authTransient` — la règle et sa classification vivent ensemble.
 *
 * Volontairement plus stricte que celle des lectures (`retryPolicy.ts`) : un
 * insert non idempotent retenté crée un doublon.
 */
export const retryAuthTransient = (failureCount: number, error: Error) =>
  classifyError(error) === 'authTransient' && failureCount < 3
