// Le contrôle de faisabilité de l'étape 4 de l'onboarding (REFONTE §2).
//
// C'est le seul moment où une cible irréaliste peut encore être corrigée : après
// création, la fenêtre est figée et la cadence ne se change qu'au prix d'un
// aveu. L'encart ne juge pas, il projette — « à ce rythme, vous arriverez à 60 ».
//
// Fonctions pures sur des `IsoDate`. « Aujourd'hui » vient toujours du serveur
// (`useAppToday`), jamais de l'horloge du navigateur.
import { addDays, addMonths, diffDays, startOfMonth, startOfWeek, type IsoDate } from './appDate'
import type { PeriodUnit } from '../hooks/useObjectivePeriods'

/**
 * Fin **exclusive** de la fenêtre d'un objectif, en miroir de
 * `private.objective_window()` : `[début, fin)`. Un T1 s'arrête au 1er avril
 * exclu, un annuel au 1er janvier suivant.
 */
export function windowEnd(year: number, quarter: number | null): IsoDate {
  if (quarter === null) return `${year + 1}-01-01`
  const month = quarter * 3 + 1
  return month > 12 ? `${year + 1}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`
}

/** Premier jour de la fenêtre, même convention. */
export function windowStart(year: number, quarter: number | null): IsoDate {
  const month = quarter === null ? 1 : (quarter - 1) * 3 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * L'objectif est-il **en cours** ce jour-là ? Bornes `[début, fin)`, comme
 * `private.objective_window()`.
 *
 * C'est ce qui sépare « les objectifs de l'année » (ce que charge
 * `useObjectives`) des objectifs qu'un écran d'aujourd'hui doit montrer : un
 * objectif pris pour le trimestre prochain n'attend rien cette semaine, et un
 * objectif de T1 n'a plus rien à dire en T3. Les afficher les ferait lire comme
 * des retards, et ils occuperaient des places qui sont libres.
 */
export function isWithinWindow(
  objective: { year: number; quarter: number | null },
  day: IsoDate,
): boolean {
  return (
    windowStart(objective.year, objective.quarter) <= day &&
    day < windowEnd(objective.year, objective.quarter)
  )
}

/**
 * Combien de périodes **entières restent à vivre**, aujourd'hui compris.
 *
 * La période en cours compte : on est dedans, elle peut encore produire. Les
 * périodes déjà closes ne comptent pas, même si la fenêtre a commencé avant —
 * projeter sur du passé annoncerait un résultat que personne ne peut atteindre.
 */
export function periodsLeft(unit: PeriodUnit, today: IsoDate, end: IsoDate): number {
  return periodStarts(unit, today, end).length
}

/**
 * Les débuts de période qui tombent dans `[from, to)` — le générateur dont
 * `periodsLeft`, la branche mensuelle de `periodsBetween` et les pistes de la
 * frise annuelle tirent tous leur compte. Chacun portait sa copie de la boucle.
 *
 * `from` est rabattu sur le début de SA période : une fenêtre qui commence un
 * mercredi commence, pour le décompte, au lundi de cette semaine-là.
 */
export function periodStarts(unit: PeriodUnit, from: IsoDate, to: IsoDate): IsoDate[] {
  if (to <= from) return []
  const starts: IsoDate[] = []
  let cursor = unit === 'week' ? startOfWeek(from) : startOfMonth(from)
  // Bornée : une fenêtre fait au plus 53 semaines ou 12 mois.
  while (cursor < to && starts.length < 400) {
    starts.push(cursor)
    cursor = unit === 'week' ? addDays(cursor, 7) : addMonths(cursor, 1)
  }
  return starts
}

/**
 * Nombre de périodes **entières** séparant deux jours : 0 s'ils tombent dans la
 * même semaine (ou le même mois), 1 s'ils sont voisins, etc.
 *
 * Sert à mesurer un rythme observé — « 4 400 € gagnés en 8 mois » — là où
 * `periodsLeft` compte ce qui reste à vivre. Les deux comptent des périodes,
 * mais l'un regarde derrière et l'autre devant.
 */
export function periodsBetween(unit: PeriodUnit, from: IsoDate, to: IsoDate): number {
  if (to <= from) return 0
  if (unit === 'week') {
    return Math.round(diffDays(startOfWeek(from), startOfWeek(to)) / 7)
  }
  return periodStarts('month', from, startOfMonth(to)).length
}

export type HabitProjection = {
  periodsLeft: number
  unit: PeriodUnit
  /** Ce que la cadence produit d'ici la fin de la fenêtre. */
  projected: number
  /** `null` quand aucune cible n'est saisie — il n'y a alors rien à projeter. */
  target: number | null
  /** La cible est-elle atteignable au rythme choisi ? `null` sans cible. */
  reachable: boolean | null
}

/**
 * « Il reste 20 semaines. À 3 séances par semaine, vous arriverez à 60 séances. »
 *
 * Sans cible, il n'y a pas de verdict : l'objectif se mesure à la régularité
 * seule, et l'encart se contente d'annoncer le volume.
 */
export function habitProjection(input: {
  today: IsoDate
  year: number
  quarter: number | null
  unit: PeriodUnit
  cadence: number
  target: number | null
}): HabitProjection {
  const left = periodsLeft(input.unit, input.today, windowEnd(input.year, input.quarter))
  const projected = left * input.cadence
  return {
    periodsLeft: left,
    unit: input.unit,
    projected,
    target: input.target,
    reachable: input.target === null ? null : projected >= input.target,
  }
}

export type QuantityEffort = {
  /** Ce qu'il reste à parcourir : cible moins point de départ. */
  remaining: number
  /** Le nombre de relevés qu'il reste à faire d'ici la fin de la fenêtre. */
  entriesLeft: number
  unit: PeriodUnit
  /** L'effort par relevé. `null` s'il ne reste aucun relevé, ou si c'est déjà atteint. */
  perEntry: number | null
}

/**
 * « Il vous manque 2 150 € et il reste 5 relevés. Soit 430 € par mois. »
 *
 * C'est ce chiffre-là que l'application rappellera — jamais un score.
 */
export function quantityEffort(input: {
  today: IsoDate
  year: number
  quarter: number | null
  unit: PeriodUnit
  target: number
  start: number
}): QuantityEffort {
  const left = periodsLeft(input.unit, input.today, windowEnd(input.year, input.quarter))
  const remaining = input.target - input.start
  return {
    remaining,
    entriesLeft: left,
    unit: input.unit,
    perEntry: left > 0 && remaining > 0 ? remaining / left : null,
  }
}

/** Semaines restantes dans un trimestre — la méta de la carte « Ce trimestre » de s2. */
export function weeksLeftInQuarter(today: IsoDate, year: number, quarter: number): number {
  return periodsLeft('week', today, windowEnd(year, quarter))
}
