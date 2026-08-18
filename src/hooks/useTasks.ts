// Les vues de la page Tâches sont des prédicats CLIENT sur public.task
// (rien à créer côté SQL — cf. migration 0005) : une seule requête paramétrée.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys, type TaskView } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import { endOfWeek, type IsoDate } from '../lib/appDate'

export type Task = {
  id: string
  user_id: string | null
  space_id: string | null
  list_id: string | null
  objective_id: string | null
  title: string
  description: string | null
  due_date: IsoDate | null
  is_important: boolean
  position: number
  recurrence: unknown | null
  completed_at: string | null
  /** Instant de création — sert à dater l'âge d'un élément du pool (§5). */
  created_at: string | null
}

const COLUMNS =
  'id, user_id, space_id, list_id, objective_id, title, description, due_date, is_important, position, recurrence, completed_at, created_at'

/**
 * `today` renvoie aussi les tâches du jour déjà cochées : elles restent visibles
 * barrées jusqu'à la fin du jour (SPEC §5), et le simple filtre sur `due_date`
 * suffit à les faire disparaître au changement de jour — inutile de comparer
 * `completed_at`, qui est un timestamptz et exposerait à un décalage de fuseau.
 */
export function useTasks(
  view: TaskView,
  options?: {
    listId?: string
    today?: IsoDate
    /**
     * Instant (timestamptz) avant lequel les tâches cochées ne sont plus
     * rapatriées — `public.app_day_start()` en pratique. Sans lui, `all` et
     * `list` ramènent tout l'historique des tâches terminées.
     */
    completedSince?: string
    /** Vue `objective` : les tâches rattachées à cet objectif. */
    objectiveId?: string
  },
) {
  const { status } = useAuth()
  const listId = options?.listId
  const today = options?.today
  const completedSince = options?.completedSince
  const objectiveId = options?.objectiveId

  // Toutes les vues sauf celles-ci ont besoin de la date du serveur. C'est une
  // liste de REFUS : oublier d'y ajouter une nouvelle vue sans échéance la rend
  // silencieusement inactive, sans la moindre erreur de compilation.
  const needsToday = view !== 'all' && view !== 'list' && view !== 'objective'
  // L'appelant a demandé la borne : ne pas partir sans elle, sinon la requête
  // se joue deux fois (une non bornée, puis une bornée, la key ayant changé).
  const bounded = options !== undefined && 'completedSince' in options

  return useQuery({
    queryKey: queryKeys.task.view(view, { listId, today, completedSince, objectiveId }),
    enabled:
      status === 'signedIn' &&
      (!needsToday || !!today) &&
      (view !== 'list' || !!listId) &&
      (view !== 'objective' || !!objectiveId) &&
      (!bounded || !!completedSince),
    queryFn: async (): Promise<Task[]> => {
      let query = supabase.from('task').select(COLUMNS)

      // Les guillemets sont exigés par PostgREST : un timestamptz contient des
      // « : » et un « + », que la syntaxe `or=(…)` interpréterait autrement.
      if (completedSince) {
        query = query.or(`completed_at.is.null,completed_at.gte."${completedSince}"`)
      }

      switch (view) {
        case 'today':
          query = query.eq('due_date', today!)
          break
        case 'week':
          query = query.gte('due_date', today!).lte('due_date', endOfWeek(today!))
          break
        case 'overdue':
          query = query.lt('due_date', today!).is('completed_at', null)
          break
        case 'list':
          query = query.eq('list_id', listId!)
          break
        // Les tâches reliées à un objectif — la bande « la matière » de l'écran
        // Objectifs. `switch` sans `default` : TypeScript ne signale PAS un
        // `case` manquant sur une instruction, et la vue retomberait alors sur
        // « toutes les tâches » sans le moindre bruit.
        case 'objective':
          query = query.eq('objective_id', objectiveId!)
          break
        case 'all':
          break
      }

      const { data, error } = await query
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Task[]
    },
  })
}
