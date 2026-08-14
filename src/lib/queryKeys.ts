// Fabrique centralisée des query keys — SEULE source de vérité pour les keys.
// Jamais de key littérale inline dans un hook ou un composant.
// Hiérarchique : invalider queryKeys.task.all invalide toutes les vues de tâches.

// Les 6 vues de la vue Tâches (SPEC §5)
export type TaskView = 'today' | 'tomorrow' | 'week' | 'overdue' | 'all' | 'list'

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
    view: (view: TaskView, params?: { listId?: string; today?: string; completedSince?: string }) =>
      [
        'task',
        'view',
        view,
        params?.listId ?? null,
        params?.today ?? null,
        params?.completedSince ?? null,
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
  objectiveWeek: {
    all: ['objective_week'] as const,
    byObjective: (objectiveId: string, isoYear?: number) =>
      ['objective_week', objectiveId, isoYear ?? null] as const,
    byObjectives: (objectiveIds: string[], isoYear: number) =>
      ['objective_week', 'objectives', [...objectiveIds].sort(), isoYear] as const,
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
    items: (reviewId: string) => ['review', 'detail', reviewId, 'items'] as const,
    // Notes hebdomadaires sur un trimestre : les fusées de la grille du hub et
    // la sparkline « ÉVOLUTION Qn » de l'écran Objectifs — même lecture, même
    // key. Sous `review` pour qu'une note posée invalide tout.
    // Les semaines sont identifiées `annéeISO:semaine` : une grille de trimestre
    // peut enjamber deux années ISO.
    ratingsByQuarter: (objectiveIds: string[], weeks: string[], quarter: number) =>
      ['review', 'ratings', 'quarter', [...objectiveIds].sort(), [...weeks].sort(), quarter] as const,
    // Instants d'ouverture des rituels (public.review_openings). Sous `review`
    // pour rester au même endroit que le reste du domaine, même si aucune
    // écriture ne l'invalide — c'est l'horloge qui la fait bouger.
    openings: (years: number[]) => ['review', 'openings', [...years].sort()] as const,
  },
} as const
