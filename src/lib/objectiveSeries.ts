// La série d'un objectif quantifié, telle que la courbe la trace.
//
// Le mode de saisie change entièrement la lecture d'une même liste de saisies :
// un **relevé** remplace la valeur précédente (le solde d'un compte, un poids),
// un **cumul** s'additionne (des livres, des kilomètres). Tracer un cumul sans
// sommer donnerait une courbe plate ; tracer un relevé en sommant afficherait un
// solde multiplié par le nombre de relevés.
//
// C'est la règle de `public.objective_progress` rejouée côté client — d'où un
// module partagé plutôt qu'un calcul posé dans un composant.
//
// Fonctions pures : aucune dépendance React, aucune date du navigateur.
import { periodsBetween } from './objectiveFeasibility'
import { formatMonthShort, type IsoDate } from './appDate'
import type { ObjectiveEntry } from '../hooks/useObjectiveEntries'
import type { PeriodUnit } from '../hooks/useObjectivePeriods'

export type EntryMode = 'cumul' | 'releve'

export type SeriesPoint = { date: IsoDate; value: number }

/**
 * La suite de valeurs à tracer, dans l'ordre chronologique.
 *
 * **Contrat** : `entries` arrive triée par date croissante — c'est ce que rend
 * `useObjectiveEntries` (`order('entry_date', { ascending: true })`). On ne
 * re-trie pas ici, mais changer l'ordre de cette query casserait le cumul.
 */
export function buildSeries(entries: ObjectiveEntry[], mode: EntryMode | null): SeriesPoint[] {
  if (mode !== 'cumul') {
    return entries.map((e) => ({ date: e.entry_date, value: e.value }))
  }
  let running = 0
  return entries.map((e) => {
    running += e.value
    return { date: e.entry_date, value: running }
  })
}

export type SeriesBounds = { min: number; max: number }

/** Marge verticale d'un relevé, pour qu'une décrue lente reste lisible. */
const RELEVE_PADDING = 0.1

/**
 * Les bornes verticales de la courbe — et elles dépendent du mode.
 *
 * Un **cumul** part de zéro par construction : le tracer sur `[min, max]`
 * exagérerait le bruit des derniers points. Un **relevé** non : un poids qui va
 * de 82 à 78 kg s'écraserait vers zéro et se lirait comme un effondrement. On
 * cadre alors sur la plage réellement parcourue, avec un peu d'air.
 */
export function seriesBounds(points: SeriesPoint[], mode: EntryMode | null): SeriesBounds {
  if (points.length === 0) return { min: 0, max: 1 }

  // `reduce` et non `Math.max(...values)` : le spread fait sauter la pile sur un
  // grand tableau et rend `-Infinity` sur un tableau vide.
  let lo = points[0]!.value
  let hi = points[0]!.value
  for (const p of points) {
    if (p.value < lo) lo = p.value
    if (p.value > hi) hi = p.value
  }

  if (mode === 'cumul') return { min: 0, max: hi > 0 ? hi : 1 }

  if (hi === lo) {
    // Une valeur unique, ou plusieurs identiques : tout à mi-hauteur plutôt
    // qu'une division par zéro.
    const pad = Math.abs(hi) * RELEVE_PADDING || 1
    return { min: lo - pad, max: hi + pad }
  }
  const pad = (hi - lo) * RELEVE_PADDING
  return { min: lo - pad, max: hi + pad }
}

/**
 * Position horizontale d'un point, de 0 à 1.
 *
 * Un point unique se pose au milieu : `i / (n - 1)` divise par zéro à n = 1 et
 * propage un `NaN` dans le tracé.
 */
export function pointX(index: number, count: number): number {
  return count <= 1 ? 0.5 : index / (count - 1)
}

/** Position verticale d'un point, de 0 (bas) à 1 (haut). */
export function pointY(value: number, bounds: SeriesBounds): number {
  const span = bounds.max - bounds.min
  return span <= 0 ? 0.5 : (value - bounds.min) / span
}

/**
 * Le rythme observé, par période : ce que la courbe gagne en moyenne.
 *
 * Mesuré **entre le premier et le dernier point**, pas depuis le début de la
 * fenêtre : quelqu'un qui commence à saisir en mars ne doit pas voir son rythme
 * divisé par les deux mois où il ne suivait pas encore l'objectif.
 *
 * `null` quand la série ne couvre pas au moins une période entière : deux
 * relevés le même mois ne disent rien d'un rythme mensuel.
 */
export function observedRate(points: SeriesPoint[], unit: PeriodUnit): number | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || points.length < 2) return null

  const periods = periodsBetween(unit, first.date, last.date)
  if (periods <= 0) return null
  return (last.value - first.value) / periods
}

/**
 * `count` étiquettes d'axe réparties sur la série, en mois courts français.
 * Intl rend « juil. » / « sept. » ; la maquette écrit ces mois sans point.
 */
export function seriesLabels(points: SeriesPoint[], count: number): string[] {
  if (points.length === 0 || count <= 0) return []
  const steps = Math.min(count, points.length)
  return Array.from({ length: steps }, (_, i) => {
    const index = steps === 1 ? 0 : Math.round((i / (steps - 1)) * (points.length - 1))
    const date = points[index]!.date
    return formatMonthShort(date)
  })
}
