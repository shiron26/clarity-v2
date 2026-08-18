// L'arithmétique du rituel : ce que le premier écran compte, le plafond du
// quatrième, les lignes du dernier.
//
// Module pur, sans JSX ni I/O — le pendant de `heroContent.ts` pour l'écran
// Objectifs. C'est ici que vivent les décisions de comptage, pas dans les
// composants, qui reçoivent des chaînes déjà formées.
import { formatDayMonthLong, type IsoDate } from '../../lib/appDate'
import { openingDateLabel, weekDatesLabel, weekTitle } from '../../lib/reviewPeriod'
import { periodRef } from '../../lib/objectivePeriod'
import { projectCompletion } from '../../lib/objectiveProjection'
import { buildSeries } from '../../lib/objectiveSeries'
import { formatQuantity } from '../../lib/objectiveWording'
import { periodKey, type ObjectivePeriod, type PeriodUnit } from '../../hooks/useObjectivePeriods'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveEntry } from '../../hooks/useObjectiveEntries'
import type { ObjectiveProgress } from '../../hooks/useObjectiveProgress'
import type { Task } from '../../hooks/useTasks'

/**
 * Le relevé d'un objectif pour la période qui contient `day`, dans SON unité.
 *
 * Un objectif mensuel n'a pas de ligne hebdomadaire : demander « la semaine »
 * d'une habitude mensuelle rendrait toujours `undefined`, et l'écran conclurait
 * à tort qu'elle n'a rien fait.
 */
export function periodOf(
  objective: Objective,
  periods: Map<string, ObjectivePeriod>,
  day: IsoDate,
): ObjectivePeriod | undefined {
  const unit: PeriodUnit = objective.period_unit ?? 'week'
  const ref = periodRef(unit, day)
  return periods.get(periodKey(objective.id, unit, ref.periodYear, ref.periodIndex))
}

export type RitualBanner = {
  meta: string
  cta: string
  /** `false` ⇒ bouton inerte : la règle est déjà énoncée à côté. */
  actionable: boolean
}

/**
 * Ce que dit la bannière du hub — le rendez-vous, et ce qu'on peut en faire.
 *
 * Elle porte l'information que la page affichait seule au milieu du vide quand
 * il n'y avait rien à faire : un rituel pas encore ouvert annonce sa date au
 * lieu de laisser une page blanche.
 *
 * La méta est formulée comme celle de l'encart du dashboard (`RitualCard`), et
 * ce n'est pas une répétition à corriger : les deux parlent du même rendez-vous,
 * deux formules différentes le feraient passer pour deux choses.
 */
export function ritualBanner(input: {
  weekNo: number
  currentWeekNo: number | undefined
  monday: IsoDate
  objectiveCount: number
  isOpen: boolean
  openAt: string | undefined
  validatedAt: string | null
}): RitualBanner {
  const { objectiveCount: count } = input
  const meta = `${weekTitle(input.weekNo, input.currentWeekNo)} · ${weekDatesLabel(input.monday)} · ${count} objectif${count > 1 ? 's' : ''} à passer en revue`

  if (count === 0) {
    return { meta, cta: 'Aucun objectif à passer en revue', actionable: false }
  }
  if (!input.isOpen) {
    return {
      meta,
      cta: input.openAt ? `S’ouvre le ${openingDateLabel(input.openAt)}` : 'Pas encore ouvert',
      actionable: false,
    }
  }
  return {
    meta,
    cta: input.validatedAt !== null ? 'Revoir mon rituel →' : 'Commencer mon rituel →',
    actionable: true,
  }
}

export type RitualCounts = {
  /** Le chiffre géant : la somme des trois parts. */
  total: number
  sessions: number
  entries: number
  tasks: number
}

/**
 * « 7 choses faites cette semaine · 3 séances · 1 relevé · 3 tâches ».
 *
 * Les trois parts sont **disjointes**, et c'est ce qui rend l'addition honnête :
 *
 * - une séance est un JOUR crédité sur une habitude (`objective_period.done`),
 *   pas une tâche — trois tâches cochées le même jour font une séance ;
 * - une tâche n'est comptée que si elle ne porte **aucun** objectif
 *   (`total - linked`), sinon elle serait déjà représentée par la séance ;
 * - un relevé est une saisie quantifiée, qui n'a pas de tâche du tout.
 *
 * Prendre `week_task_count.total` seul, comme le faisait l'ancien flow, compte
 * les tâches liées **et** les séances : le même effort deux fois.
 */
export function ritualCounts(input: {
  objectives: Objective[]
  periods: Map<string, ObjectivePeriod>
  entries: ObjectiveEntry[]
  weekStart: IsoDate
  weekEnd: IsoDate
  taskTotal: number
  taskLinked: number
}): RitualCounts {
  const sessions = input.objectives
    .filter((o) => o.measure === 'habitude')
    .reduce((sum, o) => sum + (periodOf(o, input.periods, input.weekStart)?.done ?? 0), 0)

  const entries = input.entries.filter(
    (e) => e.entry_date >= input.weekStart && e.entry_date <= input.weekEnd,
  ).length

  const tasks = Math.max(0, input.taskTotal - input.taskLinked)

  return { total: sessions + entries + tasks, sessions, entries, tasks }
}

/** « 3 séances · 1 relevé · 3 tâches » — les parts nulles se taisent. */
export function countsDetail(counts: RitualCounts): string {
  const parts: string[] = []
  if (counts.sessions > 0) {
    parts.push(`${counts.sessions} séance${counts.sessions > 1 ? 's' : ''}`)
  }
  if (counts.entries > 0) parts.push(`${counts.entries} relevé${counts.entries > 1 ? 's' : ''}`)
  if (counts.tasks > 0) parts.push(`${counts.tasks} tâche${counts.tasks > 1 ? 's' : ''}`)
  // Une semaine vide ne s'écrit pas « 0 séance · 0 relevé » : on ne détaille pas
  // une absence, on ouvre la porte de l'écran suivant, qui sert à la réparer.
  return parts.length > 0 ? parts.join(' · ') : 'La semaine est encore réparable'
}

/**
 * Le pool de l'écran 3 : ce qu'on a capturé sans rien promettre, du plus ancien
 * au plus récent.
 *
 * L'ordre est l'inverse d'une liste de tâches ordinaire, et c'est voulu — l'écran
 * sert à décider du sort de ce qui traîne, donc ce qui traîne le plus se présente
 * en premier. Sans rouge : c'est une information, pas un reproche.
 */
export function poolTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.completed_at === null && t.due_date === null)
    .sort((a, b) => {
      const created = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return created !== 0 ? created : a.position - b.position
    })
}

export type ProjectionLine = {
  objective: Objective
  /** « 62 sur 100 séances », « 4 400 € sur 6 000 € », « sans cadence ». */
  value: string
  /** « 3 décembre », « Cible atteinte », ou `null` quand rien ne se projette. */
  date: string | null
}

/**
 * Les lignes du dernier écran — la contrepartie du rituel.
 *
 * Toute la règle vient de `projectCompletion()` (§4) : le rythme projeté est
 * celui qu'on **observe**, avec repli sur le rythme déclaré tant qu'il n'y a pas
 * deux périodes closes. Rien n'est recalculé ici, on met en mots.
 *
 * `date: null` n'est pas un trou à combler : des jalons n'ont pas de rythme, et
 * un rythme à l'arrêt ne se commente pas — « jamais » serait un jugement.
 */
export function projectionLines(input: {
  objectives: Objective[]
  periods: Map<string, ObjectivePeriod>
  allPeriods: ObjectivePeriod[]
  totals: Map<string, number>
  progress: Map<string, ObjectiveProgress>
  entries: ObjectiveEntry[]
  today: IsoDate
}): ProjectionLine[] {
  return input.objectives.map((objective) => {
    const unit: PeriodUnit = objective.period_unit ?? 'week'
    const periods = input.allPeriods.filter(
      (p) => p.objective_id === objective.id && p.period_unit === unit,
    )
    const totalDone = input.totals.get(objective.id) ?? 0
    const quantityValue = input.progress.get(objective.id)?.value ?? 0
    const series = buildSeries(
      input.entries.filter((e) => e.objective_id === objective.id),
      objective.entry_mode,
    )

    const projection = projectCompletion({
      objective,
      today: input.today,
      periods,
      totalDone,
      series,
      quantityValue,
    })

    return {
      objective,
      value: valueOf(objective, totalDone, quantityValue),
      date:
        projection === null || projection.status === 'stalled'
          ? null
          : projection.status === 'reached'
            ? 'Cible atteinte'
            : formatDayMonthLong(projection.date, input.today),
    }
  })
}

function valueOf(objective: Objective, totalDone: number, quantityValue: number): string {
  if (objective.measure === 'jalons') return 'sans cadence'

  if (objective.measure === 'quantite') {
    const value = formatQuantity(quantityValue, objective.unit)
    return objective.target_value === null
      ? value
      : `${value} sur ${formatQuantity(objective.target_value, objective.unit)}`
  }

  // Habitude. Sans cible totale il n'y a rien à cumuler vers quoi : le chiffre
  // reste le nombre de séances, l'objectif se mesure à sa régularité seule.
  return objective.target_value === null
    ? `${totalDone} séance${totalDone > 1 ? 's' : ''}`
    : `${totalDone} sur ${formatQuantity(objective.target_value, null)} séances`
}
