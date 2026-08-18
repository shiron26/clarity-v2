// L'arithmétique du bilan de l'année — le pendant annuel de `bilanContent.ts`.
//
// Module pur. Trois chiffres, et un seul verdict par objectif : au niveau `year`,
// la base n'accepte que `achieved` (0009), il n'y a donc rien à décider ici sur
// la forme du jugement — contrairement au trimestre.
import { comparePeriods } from '../../lib/objectivePeriod'
import { distinctDays } from '../../lib/objectiveState'
import type { ObjectivePeriod } from '../../hooks/useObjectivePeriods'
import type { Objective } from '../../hooks/useObjectives'
import type { ReviewItem } from '../../hooks/useReview'

/**
 * Le verdict pré-rempli d'un objectif au bilan annuel.
 *
 * Un objectif **clôturé** arrive à « atteint » (SPEC §4.4) : `closed_at` signifie
 * précisément « je l'ai eu », et redemander la même chose en décembre ferait
 * ressaisir une décision déjà prise. Tout le reste arrive **vide** — l'absence de
 * verdict n'est ni une réussite ni un échec, et pré-remplir « pas atteint »
 * transformerait un oubli en condamnation.
 */
export function defaultVerdict(objective: Objective, item: ReviewItem | undefined): boolean | null {
  if (item?.achieved != null) return item.achieved
  return objective.closed_at !== null ? true : null
}

export type YearRecap = {
  /** Objectifs menés au bout, sur le total porté. */
  done: number
  total: number
  /** Jours où l'on a avancé sur au moins un objectif. */
  activeDays: number
  /** La plus longue suite de périodes tenues de l'année, toutes unités confondues. */
  bestRun: number
}

/**
 * Ce que l'année a produit.
 *
 * **On mène avec le cumul**, comme partout ailleurs : « menés au bout » et « jours
 * actifs » ne peuvent que monter, ils ne se retirent jamais. C'est ce qui rend
 * l'ouverture supportable même sur une année ratée.
 *
 * `bestRun` est un **record**, et c'est ce qui le distingue du streak que le §0.1
 * a supprimé : celui-là remettait à zéro et repeignait en échec tout ce qui
 * suivait un trou. Un record ne redescend pas — rater une semaine ne l'efface
 * pas, il reste le témoin d'un moment où le rythme a tenu.
 */
export function yearRecap(input: {
  objectives: Objective[]
  periods: ObjectivePeriod[]
  /** Clés `objectif|jour` — la forme rendue par `useObjectiveActiveDays`. */
  activeDays: Set<string>
  items: Map<string, ReviewItem> | undefined
}): YearRecap {
  const { objectives, periods, activeDays, items } = input

  const done = objectives.filter(
    (o) => defaultVerdict(o, items?.get(o.id)) === true,
  ).length

  return {
    done,
    total: objectives.length,
    // Des jours, pas des efforts : trois objectifs avancés le même jour font un
    // jour. La règle est partagée avec l'écran de retour (§9), d'où `lib/`.
    activeDays: distinctDays(activeDays),
    bestRun: longestRun(periods),
  }
}

/**
 * La plus longue suite de périodes tenues, tous objectifs confondus.
 *
 * Par objectif et non en agrégat : « onze semaines d'affilée » ne veut rien dire
 * si les semaines viennent d'objectifs différents. Les périodes absentes cassent
 * la suite au même titre qu'une période manquée — une période sans ligne est une
 * période où rien n'a eu lieu (ou l'objectif était clos), pas une période neutre.
 */
function longestRun(periods: ObjectivePeriod[]): number {
  const byObjective = new Map<string, ObjectivePeriod[]>()
  for (const period of periods) {
    const key = `${period.objective_id}|${period.period_unit}`
    const list = byObjective.get(key)
    if (list) list.push(period)
    else byObjective.set(key, [period])
  }

  let best = 0
  for (const list of byObjective.values()) {
    const ordered = [...list].sort((a, b) =>
      comparePeriods(
        { periodYear: a.period_year, periodIndex: a.period_index },
        { periodYear: b.period_year, periodIndex: b.period_index },
      ),
    )

    let run = 0
    let previous: ObjectivePeriod | undefined
    for (const period of ordered) {
      const held = period.target > 0 && period.done >= period.target
      // Un trou dans la numérotation rompt la suite : deux semaines tenues à
      // trois semaines d'écart ne font pas une série de deux.
      const contiguous =
        previous !== undefined &&
        (period.period_index === previous.period_index + 1 ||
          period.period_year > previous.period_year)
      run = held ? (contiguous ? run + 1 : 1) : 0
      best = Math.max(best, run)
      previous = period
    }
  }
  return best
}

/** « 218 jours actifs · meilleure série : 11 semaines » — les parts nulles se taisent. */
export function yearRecapDetail(recap: YearRecap): string {
  const parts: string[] = []
  if (recap.activeDays > 0) {
    parts.push(`${recap.activeDays} jour${recap.activeDays > 1 ? 's' : ''} actif${recap.activeDays > 1 ? 's' : ''}`)
  }
  if (recap.bestRun > 1) {
    parts.push(`meilleure série : ${recap.bestRun} périodes`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Une année posée'
}
