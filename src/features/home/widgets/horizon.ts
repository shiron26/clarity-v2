// Le calcul de « L'horizon », hors React : la position du jour dans l'année et
// la fin de la fenêtre la plus proche.
//
// Depuis que les objectifs peuvent tenir sur un trimestre, « il reste six
// semaines » n'est plus une évidence : chacun a sa propre échéance.
import { addDays, diffDays, yearProgressPercent, type IsoDate } from '../../../lib/appDate'
import { windowEnd } from '../../../lib/objectiveFeasibility'

export type HorizonWindow = {
  /** Dernier jour VÉCU de la fenêtre : `windowEnd` est exclusive. */
  lastDay: IsoDate
  /** Semaines restantes, celle en cours comprise. */
  weeksLeft: number
  /** Combien d'objectifs finissent ce jour-là. */
  count: number
  /** Tous les objectifs affichés partagent-ils cette fin ? */
  shared: boolean
}

export type HorizonState = {
  /** Position du jour dans l'année, en pourcentage. */
  progress: number
  /** La fenêtre qui se referme le plus tôt, s'il y a des objectifs. */
  nearest: HorizonWindow | null
  /** Semaines restant dans l'année, quand il n'y a aucun objectif à situer. */
  weeksLeftInYear: number
}

function weeksBetween(today: IsoDate, lastDay: IsoDate): number {
  // La semaine en cours compte : « il reste 1 semaine » le mercredi de la
  // dernière semaine dit vrai, « il reste 0 » serait faux et décourageant.
  return Math.max(1, Math.ceil((diffDays(today, lastDay) + 1) / 7))
}

export function horizonState(
  objectives: ReadonlyArray<{ year: number; quarter: number | null }>,
  today: IsoDate,
): HorizonState {
  const progress = yearProgressPercent(today)
  const weeksLeftInYear = weeksBetween(today, `${today.slice(0, 4)}-12-31`)

  if (objectives.length === 0) {
    return { progress, nearest: null, weeksLeftInYear }
  }

  const ends = objectives.map((o) => addDays(windowEnd(o.year, o.quarter), -1))
  const lastDay = ends.reduce((min, day) => (day < min ? day : min))
  const count = ends.filter((day) => day === lastDay).length

  return {
    progress,
    nearest: {
      lastDay,
      weeksLeft: weeksBetween(today, lastDay),
      count,
      shared: count === objectives.length,
    },
    weeksLeftInYear,
  }
}
