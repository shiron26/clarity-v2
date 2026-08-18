// Ce qu'un objectif a produit sur UN trimestre — le troisième bloc du panneau
// de trimestre (REFONTE §6).
//
// Fonctions pures. Chaque mesure a son vocabulaire : c'est ce qui évite de faire
// lire une quantité comme une cadence ratée.
import { addMonths, quarterAnchor, type IsoDate, type WeekRef } from './appDate'
import { comparePeriods, periodRef } from './objectivePeriod'
import { windowEnd } from './objectiveFeasibility'
import { objectiveSkinOf, type ObjectiveSkin } from './objectivePalette'
import { closureLabel, formatQuantity } from './objectiveWording'
import type { Objective } from '../hooks/useObjectives'
import type { ObjectivePeriod, PeriodUnit } from '../hooks/useObjectivePeriods'
import type { ObjectiveEntry } from '../hooks/useObjectiveEntries'
import type { Milestone } from '../hooks/useMilestones'
import { bySecondaryLast } from './objectiveState'

export type QuarterStat = {
  objective: Objective
  skin: ObjectiveSkin
  secondary: boolean
  /** Le chiffre, en gros. */
  value: string
  /** La ligne en dessous — ou la date d'arrêt, qui prend toute la place. */
  detail: string
}

/** Le trimestre `quarter` de `year`, en bornes `[début, fin)`. */
function quarterRange(year: number, quarter: number): { from: IsoDate; to: IsoDate } {
  return { from: quarterAnchor(year, quarter), to: windowEnd(year, quarter) }
}

/** Les relevés d'un objectif tombant dans le trimestre. */
function periodsOfQuarter(
  objective: Objective,
  periods: ObjectivePeriod[],
  range: { from: IsoDate; to: IsoDate },
): ObjectivePeriod[] {
  const unit = objective.period_unit
  if (unit === null) return []
  const first = periodRef(unit, range.from)
  const last = periodRef(unit, range.to)
  return periods.filter((p) => {
    if (p.objective_id !== objective.id || p.period_unit !== unit) return false
    const ref = { periodYear: p.period_year, periodIndex: p.period_index }
    return comparePeriods(ref, first) >= 0 && comparePeriods(ref, last) < 0
  })
}

const PERIOD_NOUN = {
  week: ['semaine tenue', 'semaines tenues'],
  month: ['mois tenu', 'mois tenus'],
} as const

/**
 * « 9 semaines tenues sur 13 ».
 *
 * Un décompte, **pas** la régularité : `objective_regularity()` est une fenêtre
 * glissante de 4 périodes closes, elle ne se borne pas à un trimestre. On ne la
 * réimplémente pas, on compte autre chose et on le dit autrement.
 */
function heldLabel(objective: Objective, rows: ObjectivePeriod[]): string {
  const unit = objective.period_unit
  if (unit === null || rows.length === 0) return ''
  const held = rows.filter((p) => p.done >= p.target).length
  const [one, many] = PERIOD_NOUN[unit]
  return `${held} ${held > 1 ? many : one} sur ${rows.length}`
}

/**
 * La valeur d'une quantité sur le trimestre.
 *
 * Un **cumul** s'additionne : c'est la somme des saisies de la période. Un
 * **relevé** remplace la valeur précédente — son apport, c'est l'écart entre la
 * dernière saisie du trimestre et la dernière saisie qui le précède. Un relevé
 * peut baisser (un solde bancaire baisse) : le signe est porté tel quel.
 *
 * Quand **rien ne précède le trimestre**, la référence est le point de départ de
 * l'objectif (`start_value`), pas zéro. La différence ne se voyait pas tant que
 * tous les relevés partaient de zéro ; sur « descendre à 70 kg », partie de
 * 78 kg, le premier trimestre annonçait « + 75 kg » au lieu de « − 3 kg ».
 */
function quantityValue(
  objective: Objective,
  /** Les saisies de CET objectif, déjà triées — voir `byObjective`. */
  own: ObjectiveEntry[],
  range: { from: IsoDate; to: IsoDate },
): { value: number | null; count: number; total: number } {
  const inside = own.filter((e) => e.entry_date >= range.from && e.entry_date < range.to)

  const cumul = objective.entry_mode === 'cumul'
  // Où en est l'objectif, toutes périodes confondues : un cumul s'additionne,
  // un relevé vaut sa dernière valeur.
  const total = cumul ? own.reduce((sum, e) => sum + e.value, 0) : (own.at(-1)?.value ?? 0)

  if (inside.length === 0) return { value: null, count: 0, total }

  if (cumul) {
    return { value: inside.reduce((sum, e) => sum + e.value, 0), count: inside.length, total }
  }

  const before = own.filter((e) => e.entry_date < range.from).at(-1)
  const baseline = before?.value ?? objective.start_value ?? 0
  return { value: inside.at(-1)!.value - baseline, count: inside.length, total }
}

/** « + 1 650 € » — le signe rend l'apport lisible, y compris quand il est négatif. */
function signed(value: number, unit: string | null): string {
  const formatted = formatQuantity(Math.abs(value), unit)
  return `${value < 0 ? '−' : '+'} ${formatted}`
}

/**
 * Combien de périodes du trimestre ont **commencé**.
 *
 * C'est le dénominateur de « 3 relevés sur 3 » : compter les lignes existantes
 * d'`objective_period` donnerait « 3 relevés sur 1 », puisqu'une période sans
 * saisie n'y a pas de ligne. On compte des périodes du calendrier, pas des
 * enregistrements.
 */
function periodsBegun(
  unit: PeriodUnit,
  weeks: WeekRef[],
  range: { from: IsoDate; to: IsoDate },
  today: IsoDate | null,
): number {
  const starts =
    unit === 'week'
      ? weeks.filter((w) => w.monday >= range.from).map((w) => w.monday)
      : [0, 1, 2].map((offset) => addMonths(range.from, offset))
  return starts.filter((start) => today === null || start <= today).length
}

export type QuarterTotals = {
  /** Jours crédités sur les habitudes du trimestre — le chiffre du deck 1. */
  sessions: number
  /** L'apport de chaque objectif quantifié, déjà signé et mis en mots. */
  quantities: string[]
  /** Étapes franchies, tous objectifs confondus. */
  milestones: number
}

/**
 * Ce que le trimestre a produit, **en nombres et non par objectif** — l'ouverture
 * du bilan (REFONTE §8, deck 1).
 *
 * Ici et non dans `features/review/` : les primitives de découpage (bornes du
 * trimestre, relevés de la période, apport d'une quantité) vivent déjà dans ce
 * module, et les recopier ailleurs les ferait diverger au premier ajustement.
 *
 * Les trois parts sont **disjointes** : une séance est un jour crédité sur une
 * habitude, un apport est une saisie quantifiée, une étape est un jalon. Aucun
 * effort n'y est compté deux fois — même exigence que `ritualCounts`.
 */
/**
 * Les saisies rangées par objectif, triées par date.
 *
 * Un seul tri, à la construction : `quantityValue` lit `own.at(-1)` pour un
 * relevé, donc l'ordre fait partie du contrat. S'en remettre au `ORDER BY` de
 * `useObjectiveEntriesRange` en ferait un invariant implicite, cassable à
 * distance ; le refaire par objectif — ce que faisait le code d'avant — le
 * payait autant de fois qu'il y a d'objectifs.
 */
function byObjective(entries: ObjectiveEntry[]): Map<string, ObjectiveEntry[]> {
  const map = new Map<string, ObjectiveEntry[]>()
  for (const entry of entries) {
    const bucket = map.get(entry.objective_id)
    if (bucket) bucket.push(entry)
    else map.set(entry.objective_id, [entry])
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.entry_date.localeCompare(b.entry_date))
  }
  return map
}

export function buildQuarterTotals(input: {
  objectives: Objective[]
  periods: ObjectivePeriod[]
  entries: ObjectiveEntry[]
  milestones: Milestone[]
  year: number
  quarter: number
}): QuarterTotals {
  const { objectives, periods, entries, milestones, year, quarter } = input
  const range = quarterRange(year, quarter)
  const entriesOf = byObjective(entries)

  let sessions = 0
  const quantities: string[] = []

  for (const objective of objectives) {
    if (objective.measure === 'habitude') {
      sessions += periodsOfQuarter(objective, periods, range).reduce((sum, p) => sum + p.done, 0)
    } else if (objective.measure === 'quantite') {
      const { value } = quantityValue(objective, entriesOf.get(objective.id) ?? [], range)
      // Un apport nul ne s'écrit pas : « + 0 € » détaillerait une absence, ce que
      // l'ouverture d'une cérémonie ne fait jamais.
      if (value !== null && value !== 0) quantities.push(signed(value, objective.unit))
    }
  }

  const own = new Set(objectives.map((o) => o.id))
  const done = milestones.filter(
    (m) => own.has(m.objective_id) && m.completed_at !== null,
  ).length

  return { sessions, quantities, milestones: done }
}

export function buildQuarterStats(input: {
  objectives: Objective[]
  periods: ObjectivePeriod[]
  entries: ObjectiveEntry[]
  milestones: Milestone[]
  weeks: WeekRef[]
  year: number
  quarter: number
  today: IsoDate | null
}): QuarterStat[] {
  const { objectives, periods, entries, milestones, weeks, year, quarter, today } = input
  const range = quarterRange(year, quarter)
  const entriesOf = byObjective(entries)

  // Les secondaires ferment la grille, comme ils ferment la frise.
  const ordered = [...objectives].sort(bySecondaryLast)

  return ordered.map((objective) => {
    const rows = periodsOfQuarter(objective, periods, range)

    let value = '—'
    let detail = ''

    if (objective.measure === 'habitude') {
      const done = rows.reduce((sum, p) => sum + p.done, 0)
      value = `${done} séance${done > 1 ? 's' : ''}`
      detail = heldLabel(objective, rows)
    } else if (objective.measure === 'quantite') {
      const { value: amount, count, total } = quantityValue(
        objective,
        entriesOf.get(objective.id) ?? [],
        range,
      )
      value = amount === null ? '—' : signed(amount, objective.unit)
      if (objective.entry_mode === 'cumul') {
        // Un cumul n'a pas de relevé attendu : il s'additionne. Ce qui compte,
        // c'est où en est le total — « 11 au total ».
        detail = `${formatQuantity(total, objective.unit)} au total`
      } else {
        const expected = periodsBegun(objective.period_unit!, weeks, range, today)
        detail = `${count} relevé${count > 1 ? 's' : ''} sur ${Math.max(expected, count)}`
      }
    } else {
      const own = milestones.filter((m) => m.objective_id === objective.id)
      const done = own.filter((m) => m.completed_at !== null).length
      value = `${done} étape${done > 1 ? 's' : ''}`
      detail = `sur ${own.length}`
    }

    // L'arrêt prend toute la sous-ligne : c'est la seule information qui explique
    // pourquoi le chiffre s'arrête là.
    const closed = objective.closed_at?.slice(0, 10)
    if (closed !== undefined && closed >= range.from && closed < range.to) {
      detail = closureLabel(objective.closed_at!)
    }

    return {
      objective,
      skin: objectiveSkinOf(objective),
      secondary: objective.kind === 'secondaire',
      value,
      detail,
    }
  })
}
