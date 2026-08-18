// L'âge d'une tâche du pool (REFONTE §5) : « depuis 6 semaines », en méta
// discrète et **sans rouge** — c'est une information, pas un reproche. Le tri
// se fait au rituel ; ici on constate.
import { diffDays, formatAge, formatAgeLong, type IsoDate } from './appDate'
import type { Task } from '../hooks/useTasks'

/**
 * En dessous d'une semaine, on se tait : « 2 j » sur une ligne qu'on vient
 * d'écrire est du bruit, et transformerait le constat en compte à rebours.
 */
const MIN_DAYS = 7

export type TaskAge = {
  /** « 6 sem » — la forme affichée en fin de ligne. */
  short: string
  /** « depuis 6 semaines » — l'infobulle et les lecteurs d'écran. */
  long: string
}

/**
 * `created_at` est un `timestamptz` ; on n'en prend que la part de date, sans
 * jamais passer par `new Date()` — l'horloge et le fuseau du navigateur sont
 * hors-jeu (AGENTS.md), l'ancre est `today`, qui vient du serveur.
 *
 * Cette part est celle d'UTC, donc à un jour près du jour applicatif. Sans
 * importance pour un âge exprimé en semaines, et le corriger demanderait une
 * conversion de fuseau côté client — exactement ce qu'on évite.
 */
export function taskAge(task: Task, today: IsoDate): TaskAge | null {
  if (task.created_at === null) return null
  const created = task.created_at.slice(0, 10) as IsoDate
  if (diffDays(created, today) < MIN_DAYS) return null
  return { short: formatAge(created, today), long: formatAgeLong(created, today) }
}
