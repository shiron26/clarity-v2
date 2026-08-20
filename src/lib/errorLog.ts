// Le journal local des erreurs, pour pouvoir nommer une panne après coup.
//
// Raison d'être : les pannes qui nous intéressent arrivent au réveil, souvent
// sur la PWA installée du téléphone, là où aucune console n'est accessible. Sans
// trace, la seule information qui remonte est « ça a encore affiché une erreur ».
//
// Un Sentry ferait ça mieux, et c'est délibérément écarté : envoyer des messages
// d'erreur PostgREST à un tiers va contre le chiffrement en base. Le journal
// reste sur l'appareil, il ne part nulle part.
//
// Deux gardes qui ne se devinent pas :
//  - AUCUNE donnée métier sur disque. Le message n'est retenu que pour les
//    classes qui servent au diagnostic (transport, réponse non reconnue) : une
//    règle métier ou un conflit d'unicité, eux, portent des valeurs de lignes
//    dans leur texte, et ces lignes sont déchiffrées. Même esprit que la règle
//    PWA « aucune réponse PostgREST en cache ».
//  - Lecture DÉFENSIVE, comme `dashboardLayout.ts` : une entrée illisible
//    disparaît, elle ne produit jamais d'erreur à l'écran. Un journal d'erreurs
//    qui plante est une plaisanterie.
import { classifyError, errorCode, errorMessageText, type ErrorKind } from './queryError'

const STORAGE_KEY = 'clarity.errors.v1'
const MAX_ENTRIES = 20
const MAX_MESSAGE = 120

/** Les seules classes dont le message est technique de bout en bout. */
const MESSAGE_SAFE_KINDS: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  'offline',
  'unknown',
  'authTransient',
  'authGone',
])

export type ErrorEntry = {
  /** Horodatage technique : `Date.now()`, pas le jour applicatif. */
  at: number
  /** La clé de query, aplatie — c'est elle qui désigne l'appel fautif. */
  key: string
  kind: ErrorKind
  code: string | null
  message: string | null
}

function isEntry(value: unknown): value is ErrorEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<ErrorEntry>
  return (
    typeof entry.at === 'number' &&
    typeof entry.key === 'string' &&
    typeof entry.kind === 'string' &&
    (entry.code === null || typeof entry.code === 'string') &&
    (entry.message === null || typeof entry.message === 'string')
  )
}

export function readErrorLog(): ErrorEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).slice(-MAX_ENTRIES)
  } catch {
    // Stockage indisponible (Safari en navigation privée) ou JSON corrompu.
    return []
  }
}

export function clearErrorLog() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Rien à faire : le journal est un confort, pas une fonction du produit.
  }
}

/** Une entrée, sans jamais laisser une valeur de ligne atterrir sur le disque. */
export function buildEntry(key: readonly unknown[], error: unknown, at: number): ErrorEntry {
  const kind = classifyError(error)
  const raw = MESSAGE_SAFE_KINDS.has(kind) ? errorMessageText(error) : null
  return {
    at,
    key: key.map((part) => (typeof part === 'object' ? JSON.stringify(part) : String(part))).join(' · '),
    kind,
    code: errorCode(error),
    message: raw ? raw.slice(0, MAX_MESSAGE) : null,
  }
}

export function logQueryError(key: readonly unknown[], error: unknown, at: number = Date.now()) {
  try {
    const next = [...readErrorLog(), buildEntry(key, error, at)].slice(-MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Idem : on ne casse jamais un écran pour un journal.
  }
}

/** Le journal en texte, pour le bouton « Copier ». */
export function formatErrorLog(entries: ErrorEntry[]): string {
  if (entries.length === 0) return 'Aucune erreur enregistrée.'
  return entries
    .map((entry) => {
      const stamp = new Date(entry.at).toISOString()
      const code = entry.code ?? 'sans code'
      return [stamp, entry.kind, code, entry.key, entry.message ?? ''].join(' | ')
    })
    .join('\n')
}
