// Vocabulaire et arithmétique des périodes de review. Fonctions pures : aucune
// ne lit l'horloge, tout dérive de l'ancre serveur passée par l'écran.
import { addDays, type IsoDate } from '../../lib/appDate'
import type { Objective } from '../../hooks/useObjectives'

/** « Semaine 33 · en cours » — le suffixe ne s'affiche que sur la semaine vécue. */
export function weekTitle(weekNo: number, currentWeekNo: number | undefined): string {
  return weekNo === currentWeekNo ? `Semaine ${weekNo} · en cours` : `Semaine ${weekNo}`
}

/** « Q3 · en cours ». */
export function quarterTitle(quarter: number, currentQuarter: number | undefined): string {
  return quarter === currentQuarter ? `Q${quarter} · en cours` : `Q${quarter}`
}

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })
const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' })

function month(date: IsoDate): string {
  // Intl rend « juil. » / « sept. » ; la maquette écrit ces mois sans point.
  return MONTH.format(new Date(`${date}T12:00:00Z`)).replace('.', '')
}

function day(date: IsoDate): string {
  return DAY.format(new Date(`${date}T12:00:00Z`))
}

/**
 * « 10 – 16 août » quand la semaine tient dans un mois, « 27 juil – 2 août »
 * quand elle l'enjambe.
 */
export function weekDatesLabel(monday: IsoDate): string {
  const sunday = addDays(monday, 6)
  const from = month(monday)
  const to = month(sunday)
  return from === to
    ? `${day(monday)} – ${day(sunday)} ${to}`
    : `${day(monday)} ${from} – ${day(sunday)} ${to}`
}

/** « 25 sept » — la date d'ouverture affichée sur une pastille verrouillée. */
export function openingDateLabel(openAt: string): string {
  const date = new Date(openAt)
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    .format(date)
    .replace('.', '')
}

/**
 * Les objectifs qu'une période met au jugement.
 *
 * SPEC §3 : `closed_at IS NULL OR closed_at >= début de la période`. La période
 * en cours au moment de la clôture inclut l'objectif une dernière fois ; celles
 * qui commencent après ne le voient plus. Non implémentée en SQL, la règle est
 * donc appliquée ici — et nulle part ailleurs.
 */
export function objectivesForPeriod(
  objectives: Objective[],
  start: IsoDate,
): Objective[] {
  const startInstant = `${start}T00:00:00`
  return objectives.filter((o) => o.closed_at === null || o.closed_at >= startInstant)
}
