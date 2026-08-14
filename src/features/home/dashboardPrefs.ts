// Préférences d'affichage du dashboard. Volontairement CLIENT-ONLY : rien ne
// remonte en base. C'est du state client (ce que je veux voir sur mon écran),
// pas du server state — donc ni TanStack Query, ni colonne, ni migration.
//
// Clé par utilisateur : deux comptes sur le même navigateur ne partagent pas
// leurs réglages, et « masquer les objectifs » ne fuite pas d'un compte à l'autre.

export type DashboardPrefs = {
  /** Masque les titres d'objectifs (regard par-dessus l'épaule). */
  privacy: boolean
  showObjectives: boolean
  showMilestones: boolean
  showFocus: boolean
  showStats: boolean
}

export const DEFAULT_PREFS: DashboardPrefs = {
  privacy: false,
  showObjectives: true,
  showMilestones: true,
  showFocus: true,
  showStats: true,
}

export const PREF_ROWS: { key: keyof DashboardPrefs; label: string; hint: string }[] = [
  {
    key: 'showObjectives',
    label: 'Section Objectifs',
    hint: 'Cartes d’objectifs en haut du dashboard',
  },
  { key: 'showMilestones', label: 'Jalons', hint: 'Afficher les jalons sur les cartes d’objectif' },
  { key: 'showFocus', label: 'Focus du jour', hint: 'Bloc des tâches du jour et des retards' },
  { key: 'showStats', label: 'Statistiques', hint: 'Activité du trimestre, semaine par semaine' },
]

export function prefsStorageKey(userId: string): string {
  return `clarity.dashboard.${userId}`
}

export function readPrefs(userId: string): DashboardPrefs {
  try {
    const raw = window.localStorage.getItem(prefsStorageKey(userId))
    if (!raw) return DEFAULT_PREFS
    // Fusion avec les défauts : un réglage ajouté plus tard ne casse pas les
    // préférences déjà stockées.
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<DashboardPrefs>) }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writePrefs(userId: string, prefs: DashboardPrefs): void {
  try {
    window.localStorage.setItem(prefsStorageKey(userId), JSON.stringify(prefs))
  } catch {
    // Stockage indisponible : les réglages restent valables pour la session.
  }
}
