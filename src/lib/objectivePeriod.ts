// Désigner une période, côté client, EXACTEMENT comme la base la désigne.
//
// `private.period_year` / `private.period_index` (migration
// 20260816213912_objective_period_regularity.sql) posent une asymétrie qu'il
// faut reproduire à la lettre, sous peine de rater silencieusement les périodes
// de fin décembre :
//
//   semaine → (extract(ISOYEAR), extract(WEEK))   ← année ISO
//   mois    → (extract(YEAR),    extract(MONTH))  ← année civile
//
// Se tromper d'année ne lève aucune erreur : la ligne cherchée n'est simplement
// jamais trouvée, et la période paraît vide.
import { isoWeek, year as civilYear, type IsoDate } from './appDate'
import type { ObjectivePeriod, PeriodUnit } from '../hooks/useObjectivePeriods'

export type PeriodRef = { periodYear: number; periodIndex: number }

/** La période qui contient `date`, dans l'unité donnée. */
export function periodRef(unit: PeriodUnit, date: IsoDate): PeriodRef {
  if (unit === 'week') {
    const { isoYear, isoWeek: weekNo } = isoWeek(date)
    return { periodYear: isoYear, periodIndex: weekNo }
  }
  return { periodYear: civilYear(date), periodIndex: Number(date.slice(5, 7)) }
}

/**
 * L'**année à charger** pour couvrir `date` — l'argument de `useObjectivePeriods`.
 *
 * Année ISO en hebdomadaire, année civile en mensuel : c'est la même asymétrie
 * que ci-dessus, et la confondre ferait manquer la semaine 1 d'une année qui
 * commence un jeudi.
 */
export function periodYearFor(unit: PeriodUnit, date: IsoDate): number {
  return periodRef(unit, date).periodYear
}

/** Ordre chronologique de deux périodes de même unité. */
export function comparePeriods(a: PeriodRef, b: PeriodRef): number {
  return a.periodYear - b.periodYear || a.periodIndex - b.periodIndex
}

/**
 * Ce que les périodes **closes** totalisent : leur nombre et la somme des jours
 * crédités.
 *
 * « Close » = strictement antérieure à la période en cours — la même définition
 * qu'`objective_regularity`, et c'est ce qui rend la mesure supportable : le
 * chiffre ne bouge pas pendant qu'on vit la période.
 *
 * `done` n'est **pas** plafonné à `target` ici, contrairement à la régularité :
 * on cumule ce qui a réellement été fait, parce que c'est ce cumul-là qui
 * remplit la cible totale (« 62 sur 100 »). Plafonner projetterait une date plus
 * tardive que la réalité pour quelqu'un qui dépasse sa cadence.
 */
export function closedPeriods(
  periods: ObjectivePeriod[],
  unit: PeriodUnit,
  today: IsoDate,
): { count: number; done: number } {
  const current = periodRef(unit, today)
  let count = 0
  let done = 0
  for (const p of periods) {
    if (p.period_unit !== unit) continue
    const ref = { periodYear: p.period_year, periodIndex: p.period_index }
    if (comparePeriods(ref, current) >= 0) continue
    count += 1
    done += p.done
  }
  return { count, done }
}

/** Cumul de TOUTES les périodes chargées, période en cours comprise — le « 62 ». */
export function totalDone(periods: ObjectivePeriod[], unit: PeriodUnit): number {
  return periods.reduce((sum, p) => (p.period_unit === unit ? sum + p.done : sum), 0)
}
