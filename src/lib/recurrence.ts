// Forme du JSON `task.recurrence`. Ce module est le SEUL endroit qui la connaît
// côté client, et il doit rester le miroir exact de `private.next_due` :
//   { type: 'daily',   interval }              → jour de complétion + interval jours
//   { type: 'weekly',  interval, weekdays[] }  → prochain jour listé, sinon lundi + 7×interval
//   { type: 'monthly', interval }              → jour de complétion + interval mois
//
// La forme est désormais validée EN BASE (`task_recurrence_shape`, contrainte
// CHECK) : émettre autre chose ne fige plus la chaîne en silence, cela lève.
// Ce module reste néanmoins défensif à la lecture, puisqu'il relit du `unknown`.
//
// Il n'y a pas d'objet « série » : chaque occurrence porte sa propre règle, et le
// serveur crée la suivante à la complétion (SPEC §4.3). Une occurrence ne se coche
// pas avant son échéance — c'est ce qui garantit que la suivante tombe après.
import type { Json } from '../types/database'
import type { IsoDate } from './appDate'

export type RecurrenceType = 'daily' | 'weekly' | 'monthly'

export type Recurrence = {
  type: RecurrenceType
  /** ≥ 1. Le serveur clampe déjà (`greatest(…, 1)`), on ne lui envoie pas de 0. */
  interval: number
  /** Jours ISO (1 = lundi … 7 = dimanche), hebdomadaire uniquement. */
  weekdays?: number[]
}

/**
 * Ce que l'utilisateur choisit dans le segmenté. « Annuel » n'existe pas côté
 * serveur : il s'encode en mois × 12, ce que `next_due` calcule exactement
 * (`make_interval(months => 12)`).
 */
export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export const WEEKDAYS: ReadonlyArray<{ iso: number; short: string; long: string }> = [
  { iso: 1, short: 'L', long: 'lundi' },
  { iso: 2, short: 'M', long: 'mardi' },
  { iso: 3, short: 'M', long: 'mercredi' },
  { iso: 4, short: 'J', long: 'jeudi' },
  { iso: 5, short: 'V', long: 'vendredi' },
  { iso: 6, short: 'S', long: 'samedi' },
  { iso: 7, short: 'D', long: 'dimanche' },
]

/** `Task.recurrence` est un `unknown` venu de la base : on ne fait confiance à rien. */
export function parseRecurrence(value: unknown): Recurrence | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>

  const type = raw.type
  if (type !== 'daily' && type !== 'weekly' && type !== 'monthly') return null

  const interval = Math.max(1, Math.trunc(Number(raw.interval ?? 1)) || 1)

  if (type !== 'weekly') return { type, interval }

  const weekdays = Array.isArray(raw.weekdays)
    ? [...new Set(raw.weekdays.map((d) => Math.trunc(Number(d))).filter((d) => d >= 1 && d <= 7))].sort(
        (a, b) => a - b,
      )
    : []

  return weekdays.length > 0 ? { type, interval, weekdays } : { type, interval }
}

/**
 * « Cette tâche se répète-t-elle ? » — la question que posent le badge ↻ et le
 * choix à la suppression.
 *
 * `recurrence != null` ne suffit pas : une règle que `parseRecurrence` ne sait pas
 * lire est une chaîne morte côté serveur (`next_due` rend null), et la ligne
 * affichait pourtant ↻ pendant que l'éditeur affichait « Aucune ».
 */
export function isRecurring(value: unknown): boolean {
  return parseRecurrence(value) !== null
}

/**
 * Pourquoi la case est verrouillée, ou `null` si elle ne l'est pas.
 *
 * Le serveur refuse de cocher une occurrence avant son échéance : la suivante se
 * calcule depuis le jour de la coche, elle retomberait sur la date qu'on vient de
 * cocher et chaque clic fabriquerait un doublon. La case est donc désactivée avant
 * l'échéance plutôt que de laisser partir un appel qui reviendra en erreur.
 */
export function recurrenceLockReason(
  task: { recurrence: unknown; due_date: IsoDate | null; completed_at: string | null },
  today: IsoDate,
): string | null {
  if (task.completed_at !== null) return null
  if (!isRecurring(task.recurrence)) return null
  if (task.due_date === null || task.due_date <= today) return null
  return 'Cette tâche se répète : elle ne se coche pas avant son échéance.'
}

/** N'émet que les clés que le serveur lit — aucune donnée parasite en base. */
export function toRecurrenceJson(rule: Recurrence | null): Json | null {
  if (!rule) return null
  if (rule.type === 'weekly' && rule.weekdays?.length) {
    return { type: rule.type, interval: rule.interval, weekdays: rule.weekdays }
  }
  return { type: rule.type, interval: rule.interval }
}

/** Le segment à cocher dans l'éditeur pour une règle donnée. */
export function presetOf(rule: Recurrence | null): RecurrencePreset {
  if (!rule) return 'none'
  if (rule.type === 'monthly' && rule.interval % 12 === 0) return 'yearly'
  return rule.type
}

/** Nombre affiché dans « Tous les N … » : les ans sont des mois divisés par 12. */
export function intervalOf(rule: Recurrence | null): number {
  if (!rule) return 1
  return presetOf(rule) === 'yearly' ? rule.interval / 12 : rule.interval
}

/** Construit une règle depuis l'état de l'éditeur. `none` → pas de récurrence. */
export function buildRecurrence(
  preset: RecurrencePreset,
  interval: number,
  weekdays: number[],
): Recurrence | null {
  const every = Math.max(1, Math.trunc(interval) || 1)
  switch (preset) {
    case 'none':
      return null
    case 'daily':
      return { type: 'daily', interval: every }
    case 'weekly':
      return weekdays.length > 0
        ? { type: 'weekly', interval: every, weekdays: [...weekdays].sort((a, b) => a - b) }
        : { type: 'weekly', interval: every }
    case 'monthly':
      return { type: 'monthly', interval: every }
    case 'yearly':
      return { type: 'monthly', interval: every * 12 }
  }
}

const UNITS: Record<RecurrencePreset, [string, string]> = {
  none: ['', ''],
  daily: ['jour', 'jours'],
  weekly: ['semaine', 'semaines'],
  monthly: ['mois', 'mois'],
  yearly: ['an', 'ans'],
}

/** Nom de l'unité pour « Tous les <n> ___ ». */
export function unitLabel(preset: RecurrencePreset, interval: number): string {
  const [one, many] = UNITS[preset]
  return interval === 1 ? one : many
}

const SIMPLE: Record<RecurrencePreset, string> = {
  none: 'Aucune',
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  yearly: 'Annuel',
}

/**
 * La répétition dite dans une phrase : « tous les jours », « toutes les
 * semaines », « tous les 3 mois ». `recurrenceSummary` rend un libellé de
 * bouton (« Hebdomadaire »), qui ne se glisse dans aucune phrase sans jurer.
 */
export function recurrenceSentence(rule: Recurrence | null): string {
  const preset = presetOf(rule)
  if (preset === 'none') return ''

  const every = intervalOf(rule)
  // Toujours le pluriel : « tous les jour » n'existe pas, même à l'unité.
  const unit = unitLabel(preset, 2)
  const article = preset === 'weekly' ? 'toutes les' : 'tous les'
  return every === 1 ? `${article} ${unit}` : `${article} ${every} ${unit}`
}

/**
 * Résumé affiché sur le déclencheur « ↻ … ». Volontairement court : les jours
 * retenus sont visibles juste en dessous, dans le panneau, et un libellé long
 * ferait passer la barre d'outils à la ligne.
 */
export function recurrenceSummary(rule: Recurrence | null): string {
  const preset = presetOf(rule)
  if (preset === 'none') return SIMPLE.none

  const every = intervalOf(rule)
  return every === 1 ? SIMPLE[preset] : `Tous les ${every} ${unitLabel(preset, every)}`
}
