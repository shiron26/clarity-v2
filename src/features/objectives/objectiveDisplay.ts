// Helpers d'affichage du domaine Objectifs — purs, sans dépendance React.
import type { ObjectiveWeek } from '../../hooks/useObjectiveWeeks'

/** « Quotidien » n'est pas un cas particulier, c'est simplement 7 (SPEC §4.1). */
export function cadenceLabel(cadence: number | null): string {
  if (cadence === null) return ''
  return cadence === 7 ? 'Quotidien' : `${cadence}×/semaine`
}

export type Trend = {
  label: string
  sub: string
  color: string
  bg: string
  glow: string
  rotation: string
}

export const TRENDS: Record<'up' | 'flat' | 'down', Trend> = {
  up: {
    label: 'En bonne voie',
    sub: 'Ton rythme des dernières semaines te met sur la trajectoire de l’objectif.',
    color: '#4f8bff',
    bg: 'rgb(79 139 255 / 0.12)',
    glow: 'rgb(79 139 255 / 0.5)',
    rotation: 'rotate(-45deg)',
  },
  flat: {
    label: 'Stagnation',
    sub: 'Ton rythme ralentit — une séance de plus cette semaine relance la dynamique.',
    color: '#f5a524',
    bg: 'rgb(245 165 36 / 0.12)',
    glow: 'rgb(245 165 36 / 0.5)',
    rotation: 'rotate(-12deg)',
  },
  down: {
    label: 'À relancer',
    sub: 'Une séance de plus cette semaine peut suffire à reprendre le rythme.',
    color: '#ff6b57',
    bg: 'rgb(255 107 87 / 0.12)',
    glow: 'rgb(255 107 87 / 0.5)',
    rotation: 'rotate(20deg)',
  },
}

/**
 * Moyenne du ratio `jours actifs / cadence figée` sur les trois dernières
 * semaines RÉVOLUES — la semaine en cours est écartée, elle n'est pas finie et
 * tirerait mécaniquement la tendance vers le bas.
 *
 * `cadence_target` est la cible figée de la semaine, jamais la cadence
 * actuelle : changer de cadence ne doit pas réécrire le passé (SPEC §3).
 */
export function computeTrend(weeks: ObjectiveWeek[]): Trend {
  const closed = weeks.slice(0, -1).slice(-3)
  if (closed.length === 0) return TRENDS.up

  const average =
    closed.reduce(
      (sum, w) => sum + (w.cadence_target > 0 ? w.active_days / w.cadence_target : 0),
      0,
    ) / closed.length

  return average >= 0.8 ? TRENDS.up : average >= 0.45 ? TRENDS.flat : TRENDS.down
}
