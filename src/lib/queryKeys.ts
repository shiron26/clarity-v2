// Fabrique centralisée des query keys — SEULE source de vérité pour les keys.
// Jamais de key littérale inline dans un hook ou un composant.
// Hiérarchique : invalider queryKeys.task.all invalide toutes les vues de tâches.

// Les requêtes de tâches. À ne pas confondre avec les vues de l'écran Tâches
// (`TaskScope`) : « Sans date » n'a pas d'entrée ici, c'est un prédicat client
// sur le jeu déjà chargé (REFONTE §5).
export type TaskView = 'today' | 'week' | 'overdue' | 'all' | 'list' | 'objective'

export const queryKeys = {
  // Date « aujourd'hui » dans le fuseau de l'app — ancre de tous les prédicats
  // de vue (public.app_today, migration 0012).
  appToday: ['app_today'] as const,
  // Instant de début de cette même journée : la seule borne comparable à un
  // `completed_at` (timestamptz). Voir migration app_day_start.
  appDayStart: ['app_day_start'] as const,
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => ['profile', userId] as const,
  },
  task: {
    all: ['task'] as const,
    // `today` fait partie de la key : au changement de jour, les prédicats de
    // vue ne désignent plus les mêmes tâches et ne doivent pas partager le cache.
    view: (
      view: TaskView,
      params?: { listId?: string; today?: string; completedSince?: string; objectiveId?: string },
    ) =>
      [
        'task',
        'view',
        view,
        params?.listId ?? null,
        params?.today ?? null,
        params?.completedSince ?? null,
        params?.objectiveId ?? null,
      ] as const,
    detail: (id: string) => ['task', 'detail', id] as const,
    // Tâches cochées sur une plage d'instants — le compteur qui ouvre le flow
    // de review. Bornes en timestamptz, pas en dates : `completed_at` en est un.
    completedRange: (from: string, to: string) =>
      ['task', 'completed_range', from, to] as const,
  },
  list: {
    all: ['list'] as const,
    detail: (id: string) => ['list', 'detail', id] as const,
  },
  space: {
    all: ['space'] as const,
    detail: (id: string) => ['space', 'detail', id] as const,
    members: (id: string) => ['space', 'detail', id, 'members'] as const,
  },
  objective: {
    all: ['objective'] as const,
    detail: (id: string) => ['objective', 'detail', id] as const,
    byYear: (year: number) => ['objective', 'year', year] as const,
    bySpace: (spaceId: string) => ['objective', 'space', spaceId] as const,
  },
  milestone: {
    all: ['milestone'] as const,
    byObjective: (objectiveId: string) => ['milestone', 'objective', objectiveId] as const,
    byObjectives: (objectiveIds: string[], year: number, quarter: number) =>
      ['milestone', 'objectives', [...objectiveIds].sort(), year, quarter] as const,
  },
  // Relevé par période — hebdomadaire ou mensuel selon l'objectif. L'unité fait
  // partie de la key : deux unités ne désignent pas les mêmes lignes.
  objectivePeriod: {
    all: ['objective_period'] as const,
    byObjectives: (objectiveIds: string[], unit: string, periodYear: number) =>
      ['objective_period', 'objectives', [...objectiveIds].sort(), unit, periodYear] as const,
  },
  // Régularité glissante (public.objective_regularity). Aucune borne de période
  // dans la key : la RPC choisit elle-même sa fenêtre de 4 périodes closes.
  objectiveRegularity: {
    all: ['objective_regularity'] as const,
    byObjectives: (objectiveIds: string[]) =>
      ['objective_regularity', [...objectiveIds].sort()] as const,
  },
  // Progression d'un objectif quantifié (public.objective_progress).
  objectiveProgress: {
    all: ['objective_progress'] as const,
    byObjectives: (objectiveIds: string[]) =>
      ['objective_progress', [...objectiveIds].sort()] as const,
  },
  // Les saisies elles-mêmes, quand l'écran a besoin du détail et pas du total.
  objectiveEntry: {
    all: ['objective_entry'] as const,
    byObjective: (objectiveId: string) => ['objective_entry', objectiveId] as const,
    range: (objectiveIds: string[], from: string, to: string) =>
      ['objective_entry', 'range', [...objectiveIds].sort(), from, to] as const,
  },
  // Séances réparées depuis le rituel (REFONTE §7). Distinctes des jours actifs :
  // celles-ci sont les lignes qu'on a le droit de retirer, ceux-là sont TOUS les
  // jours crédités, tâches comprises. L'écran 2 a besoin des deux pour savoir
  // quelle case se dé-coche.
  objectiveSession: {
    all: ['objective_session'] as const,
    range: (objectiveIds: string[], from: string, to: string) =>
      ['objective_session', [...objectiveIds].sort(), from, to] as const,
  },
  // Jours crédités reconstruits par public.objective_active_days (0012).
  objectiveActiveDays: {
    all: ['objective_active_days'] as const,
    range: (objectiveIds: string[], from: string, to: string) =>
      ['objective_active_days', [...objectiveIds].sort(), from, to] as const,
  },
  review: {
    all: ['review'] as const,
    detail: (id: string) => ['review', 'detail', id] as const,
    byPeriod: (periodType: string, year: number, index: number | null) =>
      ['review', 'period', periodType, year, index] as const,
    quarters: (year: number) => ['review', 'quarters', year] as const,
    // Les sessions hebdo d'une grille de trimestre. Un tableau d'années parce
    // qu'une grille peut enjamber deux années ISO — même raison qu'`openings`.
    weeks: (years: number[]) => ['review', 'weeks', [...years].sort()] as const,
    items: (reviewId: string) => ['review', 'detail', reviewId, 'items'] as const,
    // Instants d'ouverture des rituels (public.review_openings). Sous `review`
    // pour rester au même endroit que le reste du domaine, même si aucune
    // écriture ne l'invalide — c'est l'horloge qui la fait bouger.
    openings: (years: number[]) => ['review', 'openings', [...years].sort()] as const,
  },
} as const

/**
 * Ce que cocher une tâche, créditer une séance ou saisir un relevé rend caduc
 * côté serveur, **sans que le client puisse le deviner** : le relevé de la
 * période se refait, la régularité glissante se recalcule, la grille de densité
 * bouge. Cinq mutations portaient ce trio à l'identique ; la règle qu'AGENTS.md
 * énonce se vérifie désormais ici, en un seul endroit.
 *
 * Volontairement sans `task.all` ni `objectiveSession.all` : chaque appelant
 * invalide ce qu'il vient lui-même d'écrire, sur une ligne explicite à côté.
 */
export function invalidateProgress(queryClient: {
  invalidateQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void>
}) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.objectivePeriod.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveRegularity.all })
  void queryClient.invalidateQueries({ queryKey: queryKeys.objectiveActiveDays.all })
}
