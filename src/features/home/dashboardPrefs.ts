// Préférences d'affichage du dashboard. Volontairement CLIENT-ONLY : rien ne
// remonte en base. C'est du state client (ce que je veux voir sur mon écran),
// pas du server state — donc ni TanStack Query, ni colonne, ni migration.
//
// Clé par utilisateur : deux comptes sur le même navigateur ne partagent pas
// leurs réglages, et « masquer les objectifs » ne fuite pas d'un compte à l'autre.

// Deux réglages ont disparu avec la refonte du dashboard (§3) : « Statistiques »
// n'a plus de bloc à piloter — l'activité trimestrielle se consulte sur la page
// Objectif et sur l'écran Année — et « Jalons » n'a plus de sens, puisqu'une
// liste d'étapes n'est plus un supplément posé sur une carte quelconque : c'est
// LA visualisation d'un objectif jalonné. `readPrefs` fusionne avec les défauts,
// les préférences déjà stockées survivent au retrait.
// « Masquer les objectifs » a quitté cette table : il vaut pour toute
// l'application et vit désormais dans la coquille (`usePrivacy`). Il n'a jamais
// été une préférence d'écran — quelqu'un qui masque ses titres en open space ne
// les masque pas « sur l'accueil ». Son ancienne valeur est reprise une fois par
// `lib/privacyStorage.ts`.
export type DashboardPrefs = {
  showObjectives: boolean
  showToday: boolean
}

export const DEFAULT_PREFS: DashboardPrefs = {
  showObjectives: true,
  showToday: true,
}

export const PREF_ROWS: { key: keyof DashboardPrefs; label: string; hint: string }[] = [
  {
    key: 'showObjectives',
    label: 'Section Objectifs',
    hint: 'Cartes d’objectifs en haut du dashboard',
  },
  { key: 'showToday', label: 'Aujourd’hui', hint: 'Les tâches du jour, sous vos objectifs' },
]

function prefsStorageKey(userId: string): string {
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
