// Le chiffre qui ouvre le flow de review : combien de tâches ont été cochées
// cette semaine-là, et combien d'entre elles portaient un objectif.
//
// C'est un compteur de célébration, pas une mesure de progression : la
// progression d'un objectif se lit dans `objective_week`, jamais recalculée
// depuis les tâches (AGENTS.md). Compter des tâches cochées reste légitime —
// c'est exactement ce que la phrase affiche.
//
// Le comptage est fait par le serveur (`public.week_task_count`) parce qu'il
// dépend de `private.credit_day` : une tâche en retard cochée mercredi compte
// pour son échéance, pas pour mercredi. C'est la règle des jours actifs, donc de
// l'écran suivant du flow — les deux écrans doivent raconter la même semaine.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { useAuth } from '../features/auth/useAuth'
import { addDays, type IsoDate } from '../lib/appDate'

export type WeekTaskCount = { total: number; linked: number }

/** `weekStart` est le lundi de la semaine, au format `YYYY-MM-DD`. */
export function useWeekTaskCount(weekStart: IsoDate | undefined) {
  const { status } = useAuth()

  const from = weekStart
  const to = weekStart ? addDays(weekStart, 6) : undefined

  return useQuery({
    queryKey: queryKeys.task.completedRange(from ?? '', to ?? ''),
    enabled: status === 'signedIn' && !!from && !!to,
    queryFn: async (): Promise<WeekTaskCount> => {
      const { data, error } = await supabase.rpc('week_task_count', {
        p_from: from!,
        p_to: to!,
      })
      if (error) throw error

      const row = data?.[0]
      return { total: row?.total ?? 0, linked: row?.linked ?? 0 }
    },
  })
}
