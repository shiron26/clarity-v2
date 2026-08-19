// La disposition du dashboard : quels widgets, dans quel ordre, à quelle largeur.
//
// Volontairement CLIENT-ONLY, comme les préférences qu'elle remplace : c'est du
// state client (ce que je veux voir sur mon écran), pas du server state — donc
// ni TanStack Query, ni colonne, ni migration. Le jour où la disposition devra
// suivre d'un appareil à l'autre, il faudra une table, et ce qui est stocké ici
// deviendra la valeur par défaut.
//
// Clé par utilisateur : deux comptes sur le même navigateur ne partagent pas
// leur accueil.
import type { ListKind } from '../../hooks/useLists'

// `objectives` n'est plus de la partie : la bande d'objectifs est épinglée en tête
// de l'accueil, hors grille. Une disposition enregistrée qui la contient encore la
// perd à la lecture (§ `migrate`).
export type WidgetId =
  | 'ritual'
  | 'week'
  | 'inbox'
  | 'memo'
  | 'horizon'
  | 'milestones'

/** Largeur sur la grille de trois colonnes. Ignorée en mobile, qui n'en a qu'une. */
export type WidgetSpan = 1 | 2 | 3

/** Les trois aide-mémoire, désignés par leur nature et jamais par leur id. */
export type MemoKind = Exclude<ListKind, 'task'>

export const MEMO_KINDS: MemoKind[] = ['courses', 'idees', 'notes']

export type WidgetInstance = {
  /**
   * Identité d'une instance, pas d'un type : un aide-mémoire peut être posé
   * plusieurs fois (Courses et Idées côte à côte), et c'est cette clé que le
   * glissement déplace.
   */
  key: string
  id: WidgetId
  span: WidgetSpan
  /**
   * Widget `memo` seulement. La liste est désignée par sa NATURE : le serveur la
   * sème à l'inscription et refuse sa suppression, il n'y a donc aucune cible
   * qui puisse disparaître — contrairement à un identifiant enregistré ici.
   */
  memo?: MemoKind
}

export type DashboardLayout = WidgetInstance[]

/**
 * Ce que voit un compte qui n'a jamais rien réglé : deux lignes pleines, et rien
 * qui déborde sous la ligne de flottaison.
 *
 * L'ordre et les largeurs se tiennent, ils ne sont pas interchangeables.
 *
 * - La semaine prend **deux tiers et pas la largeur entière** : à trois colonnes
 *   elle pose le retard À CÔTÉ d'elle et se lit comme un tableau, alors qu'à deux
 *   elle l'empile dessous, dans l'ordre où on les traite.
 * - « À trier » complète la ligne, et la grille l'étire sur toute sa hauteur :
 *   une boîte de réception vide a besoin de place pour ne pas se lire comme une
 *   erreur, et son champ de capture se pose en bas de la carte.
 * - Courses et l'horizon ferment la seconde ligne. C'est le seul aide-mémoire
 *   posé d'office : une liste de courses se remplit sans qu'on l'ait décidé, là
 *   où les idées et le pense-bête supposent déjà une habitude.
 *
 * Le rituel et les étapes en cours n'y sont plus : le premier a son entrée dans
 * la navigation et son encart revenait dire ce que la bande d'objectifs montre
 * déjà, la seconde double la bande. Les deux restent dans la palette.
 */
export const DEFAULT_LAYOUT: DashboardLayout = [
  { key: 'd-week', id: 'week', span: 2 },
  { key: 'd-inbox', id: 'inbox', span: 1 },
  { key: 'd-courses', id: 'memo', span: 1, memo: 'courses' },
  { key: 'd-horizon', id: 'horizon', span: 2 },
]

const WIDGET_IDS: WidgetId[] = [
  'ritual',
  'week',
  'inbox',
  'memo',
  'horizon',
  'milestones',
]

/**
 * Version du format stocké. Elle sert à une chose : distinguer une disposition
 * d'avant l'épinglage de la bande d'objectifs, qu'il faut reprendre, d'une
 * disposition récente qu'il faut laisser telle quelle — retirer volontairement le
 * widget Rituel ne doit pas le faire revenir au rechargement suivant.
 */
const LAYOUT_VERSION = 3

/**
 * Les identifiants disparus et ce qui les remplace. « Aujourd'hui » redisait mot
 * pour mot la colonne du jour de « Votre semaine » ; il a fondu dedans, avec le
 * retard qu'il portait. Une disposition qui le contient encore désigne donc la
 * semaine.
 */
const LEGACY_IDS: Record<string, WidgetId> = { today: 'week' }

type StoredLayout = { v: number; widgets: unknown[] }

function layoutStorageKey(userId: string): string {
  return `clarity.dashboard.layout.${userId}`
}

export function newWidgetKey(): string {
  return crypto.randomUUID()
}

/**
 * Une instance venue du stockage n'est jamais crue sur parole : un widget retiré
 * d'une version à l'autre, une largeur bricolée à la main, un aide-mémoire
 * inconnu. Rien de tout cela ne doit produire une erreur à l'écran — la ligne
 * fautive disparaît, le reste de l'accueil tient.
 */
function sanitize(value: unknown): WidgetInstance | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<WidgetInstance>
  if (typeof raw.id !== 'string') return null
  const id = (LEGACY_IDS[raw.id] ?? raw.id) as WidgetId
  if (!WIDGET_IDS.includes(id)) return null
  if (id === 'memo' && !MEMO_KINDS.includes(raw.memo as MemoKind)) return null
  const span: WidgetSpan = raw.span === 1 || raw.span === 2 || raw.span === 3 ? raw.span : 1
  return {
    key: typeof raw.key === 'string' && raw.key.length > 0 ? raw.key : newWidgetKey(),
    id,
    span,
    ...(id === 'memo' ? { memo: raw.memo as MemoKind } : {}),
  }
}

/**
 * Reprise d'une disposition d'avant la version 2.
 *
 * La bande d'objectifs y était un widget ; elle est désormais épinglée, et
 * `sanitize` l'a déjà écartée puisque son identifiant n'existe plus. Reste le
 * rituel : son encart était imposé en tête de page, il est devenu un widget, et
 * sans cette insertion il disparaîtrait purement et simplement chez ceux qui
 * avaient déjà rangé leur accueil.
 */
/**
 * Peut-on poser ce widget plusieurs fois ? Les aide-mémoire seulement — Courses et
 * Idées ont vocation à tenir côte à côte.
 *
 * La règle vit ici, avec le modèle, et non dans le registre : celui-ci importe
 * déjà le modèle, et l'inverse fabriquerait un cycle d'imports — au prix d'un
 * écran blanc, puisque le module se lit alors avant d'être initialisé.
 */
export function isDuplicable(id: WidgetId): boolean {
  return id === 'memo'
}

/**
 * Un widget non duplicable ne peut être posé qu'une fois. La règle vaut surtout
 * après une reprise : une disposition qui portait « Aujourd'hui » ET « Votre
 * semaine » se retrouverait sinon avec deux fois la même semaine.
 */
function dedupe(widgets: WidgetInstance[]): DashboardLayout {
  const seen = new Set<WidgetId>()
  return widgets.filter((widget) => {
    if (isDuplicable(widget.id)) return true
    if (seen.has(widget.id)) return false
    seen.add(widget.id)
    return true
  })
}

function migrate(widgets: WidgetInstance[]): DashboardLayout {
  if (widgets.some((widget) => widget.id === 'ritual')) return widgets
  return [{ key: newWidgetKey(), id: 'ritual', span: 3 }, ...widgets]
}

export function readLayout(userId: string): DashboardLayout {
  try {
    const raw = window.localStorage.getItem(layoutStorageKey(userId))
    // L'ancienne clé à deux booléens (`clarity.dashboard.<user>`) n'est plus
    // reprise : ses deux réglages n'ont plus de destinataire. « Section Objectifs »
    // désignait une bande désormais épinglée, qu'on ne cache plus, et
    // « Aujourd'hui » un bloc qui a fondu dans « Votre semaine ». Un compte qui
    // avait masqué l'un des deux repart donc de la disposition par défaut. La clé
    // reste en place : `privacyStorage` la relit pour le masquage des titres.
    if (!raw) return DEFAULT_LAYOUT

    const parsed = JSON.parse(raw) as unknown
    // Tableau nu = format d'origine, à reprendre. Objet versionné = format courant.
    const stored: StoredLayout = Array.isArray(parsed)
      ? { v: 1, widgets: parsed }
      : ((parsed ?? {}) as StoredLayout)
    if (!Array.isArray(stored.widgets)) return DEFAULT_LAYOUT

    const widgets = dedupe(
      stored.widgets.map(sanitize).filter((w): w is WidgetInstance => w !== null),
    )
    if (stored.v >= LAYOUT_VERSION) {
      // Une disposition vidée jusqu'au dernier widget reste une disposition : on ne
      // repasse pas le défaut par-dessus, ce serait défaire un choix.
      return widgets
    }

    const migrated = migrate(widgets)
    writeLayout(userId, migrated)
    return migrated
  } catch {
    return DEFAULT_LAYOUT
  }
}

export function writeLayout(userId: string, layout: DashboardLayout): void {
  try {
    window.localStorage.setItem(
      layoutStorageKey(userId),
      JSON.stringify({ v: LAYOUT_VERSION, widgets: layout } satisfies StoredLayout),
    )
  } catch {
    // Stockage indisponible : la disposition reste valable pour la session.
  }
}
