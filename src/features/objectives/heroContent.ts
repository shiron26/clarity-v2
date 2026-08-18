// Ce que l'écran d'un objectif écrit : sa ligne de méta et son grand chiffre.
//
// Module pur, sans JSX. C'est **le seul `switch` sur `measure`** de tout l'écran
// — les bandes reçoivent des chaînes déjà formées et ne savent pas ce qu'elles
// affichent. C'est ce qui permet aux cinq états de la maquette de se composer
// sans qu'aucun composant ne les connaisse.
import {
  addDays,
  formatDayMonth,
  formatDayMonthLong,
  type IsoDate,
} from '../../lib/appDate'
import { periodsLeft, windowEnd } from '../../lib/objectiveFeasibility'
import { cadenceLabel, formatQuantity } from '../../lib/objectiveWording'
import type { ObjectiveProjection } from '../../lib/objectiveProjection'
import type { Milestone } from '../../hooks/useMilestones'
import type { Objective } from '../../hooks/useObjectives'
import type { DetailLayout } from './detailLayout'

/** Une ligne de projection : la partie forte est mise en avant, pas colorée. */
export type ProjectionLine = { lead: string; strong: string; tail?: string }

export type HeroContent = {
  /** L'unique ligne de méta sous le titre. */
  meta: string
  /** Titre de la bande d'étapes — « Jalons · T3 » ou « Les étapes ». */
  milestonesTitle: string
  /** Le grand chiffre, déjà formaté. */
  value: string
  /** « sur 6 000 € », « sur 100 séances ». `null` = héros nu. */
  of: string | null
  /** Suffixe quand il n'y a pas de « sur » : « séances faites ». */
  suffix: string | null
  /** 0–100, ou `null` quand il n'y a pas de barre à tracer. */
  percent: number | null
  projection: ProjectionLine | null
}

type HeroInput = {
  objective: Objective
  layout: DetailLayout
  quarter: number
  today: IsoDate
  /** Cumul des jours crédités — le « 62 » de « 62 sur 100 ». */
  totalDone: number
  /** Valeur d'une quantité (`objective_progress`). */
  quantityValue: number
  milestones: Milestone[]
  projection: ObjectiveProjection | null
  /** Ouverture du bilan du trimestre, telle que le serveur la donne. */
  reviewOpenAt: string | undefined
}

/** « Année 2026 » · « T3, jusqu'au 30 septembre » · « T1 2026 » pour un arrêté. */
function windowText(objective: Objective, quarter: number, stopped: boolean): string {
  if (objective.quarter === null) return `Année ${objective.year}`
  if (stopped) return `T${quarter} ${objective.year}`
  const lastDay = addDays(windowEnd(objective.year, objective.quarter), -1)
  return `T${objective.quarter}, jusqu’au ${formatDayMonth(lastDay)}`
}

/**
 * La ligne de méta : ce que l'objectif **est**, jamais où il en est.
 *
 * Une seule ligne, et c'est une contrainte de conception : la version
 * précédente portait trois pastilles, qui disaient la même chose en occupant
 * la place du chiffre (REFONTE §4).
 */
function metaLine(objective: Objective, quarter: number): string {
  const stopped = objective.closed_at !== null
  const parts: string[] = []

  if (objective.kind === 'secondaire') parts.push('Secondaire')

  if (objective.measure === 'habitude') {
    parts.push('Habitude')
    if (!stopped) parts.push(cadenceLabel(objective.cadence, objective.period_unit))
  } else if (objective.measure === 'quantite') {
    parts.push(objective.kind === 'secondaire' ? 'quantité' : 'Quantité')
    parts.push(objective.period_unit === 'month' ? 'relevé mensuel' : 'relevé hebdomadaire')
    if (objective.entry_mode === 'cumul') parts.push('cumul')
  } else {
    parts.push(objective.kind === 'secondaire' ? 'étapes' : 'Jalons')
    if (!stopped) parts.push('sans cadence')
  }

  if (stopped && objective.closed_at) {
    parts.push(`arrêté le ${formatDayMonth(objective.closed_at.slice(0, 10) as IsoDate)}`)
  }

  parts.push(windowText(objective, quarter, stopped))
  return parts.join(' · ')
}

/**
 * La ligne sous la barre. Quatre formes, et une absence.
 *
 * L'absence n'est pas un trou : un objectif arrêté n'a plus de trajectoire, et
 * une habitude sans cible se mesure à sa régularité seule.
 */
function projectionLine(input: HeroInput): ProjectionLine | null {
  const { objective, projection, quarter, today } = input

  // Un secondaire ne demande rien d'ici le bilan — c'est là, et nulle part
  // ailleurs, qu'on en reparle (REFONTE §4).
  if (objective.kind === 'secondaire') {
    if (objective.closed_at !== null) return null
    const openAt = input.reviewOpenAt
    return {
      lead: 'Revu au ',
      strong: `bilan de T${quarter}`,
      tail: openAt ? `, le ${formatDayMonthLong(openAt.slice(0, 10) as IsoDate)}` : undefined,
    }
  }

  if (objective.measure === 'jalons') {
    if (objective.closed_at !== null) return null
    const weeks = periodsLeft('week', today, windowEnd(objective.year, objective.quarter))
    if (weeks <= 0) return null
    return {
      lead: 'Il reste ',
      strong: `${weeks} semaine${weeks > 1 ? 's' : ''}`,
      tail: objective.quarter === null ? ' cette année' : ` à T${objective.quarter}`,
    }
  }

  if (projection === null) return null
  if (projection.status === 'reached') return { lead: '', strong: 'Cible atteinte' }
  // « Rythme à l'arrêt » serait un reproche, et l'écran n'en fait pas : quand
  // rien ne permet de projeter, on ne dit rien.
  if (projection.status === 'stalled') return null

  const lead = projection.basis === 'observed' ? 'À ce rythme, ' : 'Au rythme prévu, '
  const verb = objective.measure === 'habitude' ? 'terminé le ' : 'atteint le '
  return {
    lead: lead + verb,
    strong: formatDayMonthLong(projection.date, today),
    tail: projection.beyondWindow ? ' — au-delà de la fenêtre' : undefined,
  }
}

export function heroContent(input: HeroInput): HeroContent {
  const { objective, layout, quarter, milestones } = input
  const bare = layout.hero === 'bare'

  const meta = metaLine(objective, quarter)
  const milestonesTitle =
    objective.measure === 'jalons' ? 'Les étapes' : `Jalons · T${quarter}`
  const projection = projectionLine(input)

  if (objective.measure === 'quantite') {
    const value = formatQuantity(input.quantityValue, objective.unit)
    const target = objective.target_value
    if (bare || target === null) {
      return { meta, milestonesTitle, value, of: null, suffix: null, percent: null, projection }
    }
    return {
      meta,
      milestonesTitle,
      value,
      of: formatQuantity(target, objective.unit),
      suffix: null,
      percent: percentOf(input.quantityValue, target),
      projection,
    }
  }

  if (objective.measure === 'jalons') {
    const done = milestones.filter((m) => m.completed_at !== null).length
    return {
      meta,
      milestonesTitle,
      value: String(done),
      of: bare ? null : `${milestones.length} étape${milestones.length > 1 ? 's' : ''}`,
      suffix: bare ? `étape${done > 1 ? 's' : ''} franchie${done > 1 ? 's' : ''}` : null,
      percent: bare ? null : percentOf(done, milestones.length),
      projection,
    }
  }

  // Habitude. Sans cible totale il n'y a rien à cumuler : le chiffre reste le
  // nombre de séances, et la barre disparaît — l'objectif se mesure alors à sa
  // régularité seule, ce que l'onboarding annonce au moment du choix.
  const done = input.totalDone
  const target = objective.target_value
  if (bare || target === null) {
    return {
      meta,
      milestonesTitle,
      value: String(done),
      of: null,
      suffix: `séance${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''}`,
      percent: null,
      projection,
    }
  }
  return {
    meta,
    milestonesTitle,
    value: String(done),
    of: `${formatQuantity(target, null)} séances`,
    suffix: null,
    percent: percentOf(done, target),
    projection,
  }
}

/** Part accomplie, bornée à 100 : une barre ne déborde pas de son rail. */
function percentOf(value: number, target: number): number | null {
  if (target <= 0) return null
  return Math.min(100, Math.round((value / target) * 100))
}
