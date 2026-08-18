// L'arithmétique et le vocabulaire du bilan de trimestre.
//
// Module pur, sans JSX ni I/O — le pendant de `ritualContent.ts` pour §8. C'est
// ici que vivent les décisions (quelle forme de jugement, quels mots), pas dans
// les decks, qui reçoivent des chaînes déjà formées.
import { windowEnd } from '../../lib/objectiveFeasibility'
import { quarterFullLabel, quarterRangeLabel } from '../../lib/quarterLabels'
import type { QuarterTotals } from '../../lib/quarterStats'
import type { Objective } from '../../hooks/useObjectives'

/**
 * Un objectif dont la fenêtre **se ferme** avec ce trimestre reçoit un verdict
 * (atteint / pas atteint) ; celui qui continue reçoit une note.
 *
 * C'est la seule nouveauté de l'écran de notation, et elle n'est pas un réglage :
 * un objectif de T3 se termine au bilan de T3, il n'y a plus rien à noter après.
 * Un annuel ne se termine qu'en T4 — d'ici là on constate un rythme, on ne
 * conclut pas. D'où la comparaison de **fins de fenêtre** et non de trimestres :
 * un objectif de T2 encore ouvert au bilan de T3 (clôture tardive) se conclut lui
 * aussi, puisque sa fenêtre est derrière nous.
 *
 * Bornes `[début, fin)`, comme `private.objective_window()`.
 */
export function verdictExpected(objective: Objective, year: number, quarter: number): boolean {
  return windowEnd(objective.year, objective.quarter) <= windowEnd(year, quarter)
}

/** « Trimestre 3 · juillet → septembre » — le sur-titre des decks. */
export function bilanEyebrow(quarter: number): string {
  return `${quarterFullLabel(quarter)} · ${quarterRangeLabel(quarter)}`
}

export type BilanRecap = { count: number; headline: string; detail: string }

/**
 * L'ouverture : **on mène avec ce qui a été fait**, jamais avec ce qui manque.
 *
 * Le chiffre géant compte les séances parce que c'est la seule part comparable
 * d'un trimestre à l'autre ; les quantités et les étapes suivent en sous-ligne,
 * chacune dans son unité. Les parts nulles se taisent — on ne détaille pas une
 * absence, on ouvre la porte de l'écran suivant.
 */
export function bilanRecap(totals: QuarterTotals, weeks: number): BilanRecap {
  const parts = [...totals.quantities]
  if (totals.milestones > 0) {
    parts.push(`${totals.milestones} étape${totals.milestones > 1 ? 's' : ''} franchie${totals.milestones > 1 ? 's' : ''}`)
  }

  return {
    count: totals.sessions,
    headline: totals.sessions === 1 ? 'séance ce trimestre' : 'séances ce trimestre',
    detail: parts.length > 0 ? parts.join(' · ') : `${weeks} semaines derrière vous`,
  }
}

/** « Objectif 2 / 3 · principal » — où l'on en est dans la file des verdicts. */
export function verdictEyebrow(index: number, total: number): string {
  return `Objectif ${index + 1} / ${total} · principal`
}

/**
 * Pourquoi cet objectif-là reçoit un verdict et pas une note.
 *
 * Sans cette ligne, la question tombe sans raison : deux objectifs voisins dans
 * la même file, l'un noté en fusées et l'autre sommé de conclure, sans que rien
 * n'explique la différence. Ce n'est pas de la mécanique — c'est un fait sur
 * l'objectif, décidé à sa création : **il était borné à cette fenêtre**.
 *
 * Rendue `null` quand on note : une note n'a pas à se justifier, c'est le cas
 * ordinaire.
 */
export function verdictReason(objective: Objective, year: number, quarter: number): string | null {
  if (!verdictExpected(objective, year, quarter)) return null
  return objective.quarter === null
    ? `Objectif de l’année ${objective.year} — elle se termine ici.`
    : `Objectif borné au trimestre ${objective.quarter} — il se termine ici.`
}
