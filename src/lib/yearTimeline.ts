// La frise de l'année : où chaque objectif commence, où il s'arrête, et ce qu'il
// a produit période par période (REFONTE §6).
//
// Fonctions pures sur des `IsoDate`. « Aujourd'hui » vient toujours du serveur
// (`useAppToday`), jamais de l'horloge du navigateur — et vaut `null` quand
// l'année consultée est révolue, ce qui suffit à éteindre le trait « aujourd'hui »
// et les voiles sans les tester ailleurs.
import { dayOfYear, daysInYear, year as civilYear, type IsoDate } from './appDate'
import { periodStarts, windowEnd, windowStart } from './objectiveFeasibility'
import { objectiveSkinOf, type ObjectiveSkin } from './objectivePalette'
import { indexPeriods, periodKey } from '../hooks/useObjectivePeriods'
import { bySecondaryLast, heatLevel } from './objectiveState'
import { periodRef } from './objectivePeriod'
import { closureLabel, windowLabel } from './objectiveWording'
import type { Objective } from '../hooks/useObjectives'
import type { ObjectivePeriod } from '../hooks/useObjectivePeriods'

/**
 * `live` court encore, `stopped` s'est arrêté avant la fin de sa fenêtre,
 * `future` n'a pas commencé. Jamais d'état « échoué » : la frise raconte une
 * année, elle ne la juge pas (REFONTE §6).
 */
export type TrackState = 'live' | 'stopped' | 'future'

export type YearTrack = {
  objective: Objective
  skin: ObjectiveSkin
  secondary: boolean
  /** Bornes de la fenêtre, en fraction d'année — `[0, 1]`. */
  from: number
  to: number
  /** Fraction d'année où la barre s'interrompt, `null` si elle va au bout. */
  stopAt: number | null
  /** Part de la BARRE déjà vécue : au-delà, le voile. */
  lived: number
  state: TrackState
  /** Un cran de densité par période de la fenêtre. Vide pour des jalons. */
  cells: number[]
  /** « T3 » · « arrêté le 18 février » · « à venir ». */
  tag: string | null
}

/**
 * Où tombe une date dans son année, de 0 (1er janvier) à 1 (31 décembre au
 * soir). Une date hors de l'année se rabat sur la borne la plus proche : la
 * fenêtre d'un objectif annuel finit le 1er janvier SUIVANT, et elle doit se
 * dessiner jusqu'au bout de la piste, pas repartir à zéro.
 */
export function yearFraction(date: IsoDate, year: number): number {
  const y = civilYear(date)
  if (y < year) return 0
  if (y > year) return 1
  return (dayOfYear(date) - 1) / daysInYear(date)
}

/**
 * Les crans de densité d'un objectif sur sa fenêtre, dans l'ordre.
 *
 * **L'intensité dit ce qui a été fait dans la période, pas depuis combien de
 * temps ça dure** — `heatLevel` ne dépend que de la période elle-même. L'ancienne
 * rampe encodait un streak et retombait à zéro dès qu'une période échouait :
 * c'est exactement la mesure que la refonte supprime (§0.1).
 *
 * Une période absente d'`objective_period` vaut le cran 0 : la ligne n'existe
 * que là où quelque chose a été enregistré.
 */
function trackCells(
  objective: Objective,
  byKey: Map<string, ObjectivePeriod>,
  from: IsoDate,
  to: IsoDate,
): number[] {
  const unit = objective.period_unit
  if (unit === null) return []

  return periodStarts(unit, from, to).map((start) => {
    const { periodYear, periodIndex } = periodRef(unit, start)
    const record = byKey.get(periodKey(objective.id, unit, periodYear, periodIndex))
    return heatLevel(record?.done ?? 0, record?.target ?? 0)
  })
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Une piste par objectif, dans l'ordre rendu par `useObjectives` (fenêtre puis
 * slot) — mais **les secondaires ferment la frise**. Ils y sont, en rangs plus
 * fins et atténués : présents, visiblement de second plan (REFONTE §6).
 */
export function buildYearTracks(input: {
  objectives: Objective[]
  periods: ObjectivePeriod[]
  year: number
  today: IsoDate | null
}): YearTrack[] {
  const { objectives, periods, year, today } = input

  const byKey = indexPeriods(periods)

  const now = today === null ? null : yearFraction(today, year)

  const ordered = [...objectives].sort(bySecondaryLast)

  return ordered.map((objective) => {
    const start = windowStart(objective.year, objective.quarter)
    const end = windowEnd(objective.year, objective.quarter)
    const from = yearFraction(start, year)
    const to = yearFraction(end, year)

    // La date d'arrêt, comme `heatmapWindow` la lit : le jour de `closed_at`.
    // Clôturer au dernier jour de sa fenêtre, c'est l'avoir courue en entier —
    // ce n'est pas un arrêt, et la barre ne doit pas s'interrompre.
    const closed = objective.closed_at?.slice(0, 10)
    const stopped = closed !== undefined && closed < end
    const stopAt = stopped ? clamp01(Math.max(from, yearFraction(closed, year))) : null

    const future = today !== null && start > today
    const state: TrackState = future ? 'future' : stopped ? 'stopped' : 'live'

    // Le voile ne couvre que ce qui n'a pas encore été vécu. Une année révolue
    // n'a pas de futur, et une barre arrêtée s'arrête pour de bon : dans les
    // deux cas la barre visible est entièrement vécue.
    const span = to - from
    const lived =
      now === null || state !== 'live' || span <= 0 ? 1 : clamp01((now - from) / span)

    return {
      objective,
      skin: objectiveSkinOf(objective),
      secondary: objective.kind === 'secondaire',
      from,
      to,
      stopAt,
      lived,
      state,
      // Un objectif à venir n'a rien produit, et la densité d'un objectif arrêté
      // se lit sur la portion vécue — dans les deux cas on part de sa fenêtre.
      cells: state === 'future' ? [] : trackCells(objective, byKey, start, closed ?? end),
      tag:
        state === 'future'
          ? 'à venir'
          : stopped
            ? closureLabel(objective.closed_at!)
            : objective.quarter === null
              ? null
              : windowLabel(objective),
    }
  })
}
