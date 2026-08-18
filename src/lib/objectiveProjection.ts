// « À ce rythme, terminé le 3 décembre » — la ligne sous la barre du héros.
//
// Séparé d'`objectiveFeasibility` volontairement : celui-là répond à « ce plan
// est-il réaliste ? » AVANT création, à partir d'une saisie en cours, et ne
// connaît aucun type serveur — c'est ce qui le rend consommable par
// l'onboarding. Celui-ci répond à « vu ce qui s'est passé, quand est-ce fini ? »,
// à partir de `ObjectivePeriod[]` et de saisies réelles. La dépendance va dans ce
// sens et jamais dans l'autre : l'observé s'appuie sur le nominal.
//
// **Le rythme est celui qu'on observe, pas celui qu'on a promis** — « à ce
// rythme » n'aurait aucun sens autrement. Repli sur le rythme déclaré tant qu'il
// n'y a pas deux périodes closes : projeter sur une seule semaine vécue
// annoncerait une date que rien ne soutient.
//
// Fonctions pures. « Aujourd'hui » vient du serveur, jamais du navigateur.
import { addDays, addMonths, startOfMonth, startOfWeek, type IsoDate } from './appDate'
import { windowEnd } from './objectiveFeasibility'
import { closedPeriods } from './objectivePeriod'
import { observedRate, type SeriesPoint } from './objectiveSeries'
import type { Objective } from '../hooks/useObjectives'
import type { ObjectivePeriod, PeriodUnit } from '../hooks/useObjectivePeriods'

/** Sous ce nombre de périodes closes, le rythme observé n'est pas une mesure. */
const MIN_CLOSED_PERIODS = 2

/** D'où vient le rythme — la copie doit pouvoir le dire. */
export type ProjectionBasis = 'observed' | 'nominal'

export type ObjectiveProjection =
  /** La cible est déjà derrière : il n'y a plus rien à projeter. */
  | { status: 'reached' }
  /** Rythme nul : annoncer une date serait mentir, annoncer « jamais » serait juger. */
  | { status: 'stalled' }
  | {
      status: 'onTrack'
      date: IsoDate
      basis: ProjectionBasis
      /** La date déborde la fenêtre de l'objectif — la copie peut le nuancer. */
      beyondWindow: boolean
    }

export type Pace = { perPeriod: number; basis: ProjectionBasis }

/**
 * Le rythme d'une habitude : séances par période close.
 *
 * On cumule le `done` **brut**, sans le plafond de la régularité : quelqu'un qui
 * fait 5 séances quand sa cadence en demande 3 avance réellement plus vite, et
 * la cible totale se remplit de ces 5. Plafonner ici annoncerait une date plus
 * tardive que la réalité — la régularité mesure un rythme tenable, la projection
 * mesure un remplissage.
 */
function habitPace(input: {
  periods: ObjectivePeriod[]
  unit: PeriodUnit
  today: IsoDate
  cadence: number
}): Pace {
  const { count, done } = closedPeriods(input.periods, input.unit, input.today)
  if (count < MIN_CLOSED_PERIODS) return { perPeriod: input.cadence, basis: 'nominal' }
  return { perPeriod: done / count, basis: 'observed' }
}

/**
 * Le rythme d'une quantité : gain par période, lu sur la série normalisée (donc
 * le mode cumul / relevé est déjà absorbé).
 *
 * **Pas de repli nominal, et ce n'est pas un oubli.** Une quantité ne déclare
 * aucun rythme, seulement une cible et une fréquence de relevé ; le « rythme
 * prévu » vaudrait donc « ce qu'il faudrait faire », et projeter dessus rendrait
 * invariablement la fin de la fenêtre — une tautologie, pas une projection. Tant
 * qu'on n'a pas vu deux relevés séparés d'une période, on se tait.
 */
function quantityPace(series: SeriesPoint[], unit: PeriodUnit): Pace | null {
  const rate = observedRate(series, unit)
  return rate === null ? null : { perPeriod: rate, basis: 'observed' }
}

/**
 * Fin de la n-ième période à partir de la période en cours.
 *
 * On rend la **fin** et non le début : « terminé le 3 décembre » désigne le
 * moment où la dernière séance nécessaire aura pu être faite, pas le lundi où
 * cette semaine-là commence.
 */
function dateAfterPeriods(today: IsoDate, unit: PeriodUnit, periods: number): IsoDate {
  if (unit === 'week') return addDays(startOfWeek(today), periods * 7 - 1)
  return addDays(addMonths(startOfMonth(today), periods), -1)
}

type ProjectionInput = {
  objective: Objective
  today: IsoDate
  /** Relevés de l'objectif, dans son unité — pour une habitude. */
  periods: ObjectivePeriod[]
  /** Cumul déjà fait : la somme des `done` pour une habitude. */
  totalDone: number
  /** Série de la courbe, déjà cumulée si le mode l'exige — pour une quantité. */
  series: SeriesPoint[]
  /** Valeur serveur d'une quantité (`objective_progress`), pas la série. */
  quantityValue: number
}

/**
 * La projection d'un objectif, ou son absence — qui est aussi une information.
 *
 * Quatre `null` d'entrée, tous voulus : un objectif **arrêté** (il n'a plus de
 * trajectoire), un **secondaire** (rien ne lui est demandé d'ici le bilan), des
 * **jalons** (des étapes n'ont pas de rythme), et une **cible absente** — une
 * habitude sans cible totale se mesure à sa régularité seule, ce que
 * l'onboarding annonce déjà au moment du choix.
 */
export function projectCompletion(input: ProjectionInput): ObjectiveProjection | null {
  const { objective, today } = input

  if (objective.closed_at !== null) return null
  if (objective.kind === 'secondaire') return null
  if (objective.measure === 'jalons') return null

  const target = objective.target_value
  if (target === null) return null

  const unit: PeriodUnit = objective.period_unit ?? 'week'
  const habit = objective.measure === 'habitude'

  const remaining = target - (habit ? input.totalDone : input.quantityValue)
  if (remaining <= 0) return { status: 'reached' }

  const pace = habit
    ? habitPace({ periods: input.periods, unit, today, cadence: objective.cadence ?? 1 })
    : quantityPace(input.series, unit)

  if (pace === null) return null
  if (pace.perPeriod <= 0) return { status: 'stalled' }

  const date = dateAfterPeriods(today, unit, Math.ceil(remaining / pace.perPeriod))
  return {
    status: 'onTrack',
    date,
    basis: pace.basis,
    beyondWindow: date >= windowEnd(objective.year, objective.quarter),
  }
}
