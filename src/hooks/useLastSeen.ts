// Depuis combien de temps on n'était pas venu — et l'enregistrement de la visite,
// dans le même aller-retour (REFONTE §9).
//
// `public.touch_last_seen()` **écrit** : c'est une mutation, pas une query. Une
// query qui écrit se rejouerait au retour de focus ou à la reconnexion, et
// effacerait l'écart qu'elle vient d'annoncer.
//
// Corollaire, et c'est ce qui structure tout l'écran : **l'écart n'est lisible
// qu'une fois**. Le second appel rend la date du jour, donc zéro. Le hook le fige
// donc en state — même verrou que `active` dans `ReviewPage` / `BilanPage`, pour
// la même raison : la cérémonie ne peut pas dépendre d'un état serveur qu'elle
// vient elle-même de changer.
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/useAuth'
import { useAppToday } from './useAppToday'
import { diffDays, type IsoDate } from '../lib/appDate'

/**
 * Au-delà de sept jours, l'app s'ouvre sur un accueil plutôt que sur le
 * dashboard. Une semaine, parce que c'est l'unité du rituel : sauter un rendez-vous
 * hebdomadaire est ordinaire, en sauter deux ne l'est plus.
 */
const ABSENCE_DAYS = 7

export type Absence = {
  /** Dernier jour applicatif d'ouverture, tel que le serveur l'avait mémorisé. */
  previous: IsoDate
  /** Jours écoulés depuis. Toujours `>= ABSENCE_DAYS`. */
  gap: number
}

export type LastSeenState = {
  /** L'absence à annoncer, ou `null` quand il n'y a rien à dire. */
  absence: Absence | null
  isPending: boolean
}

export function useLastSeen(): LastSeenState {
  const { status } = useAuth()
  const todayQuery = useAppToday()
  const today = todayQuery.data

  const [absence, setAbsence] = useState<Absence | null>(null)
  const [settled, setSettled] = useState(false)

  const touch = useMutation({
    mutationFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('touch_last_seen')
      if (error) throw error
      return data
    },
  })

  // Une seule fois par montage. Sans cette garde, un rendu de plus relancerait la
  // RPC — et le second appel rend toujours la date du jour.
  const requested = useRef(false)
  const { mutate } = touch

  useEffect(() => {
    if (requested.current || status !== 'signedIn' || !today) return
    requested.current = true

    mutate(undefined, {
      onSuccess: (previous) => {
        setSettled(true)
        // `null` = première visite. Une donnée absente n'est pas une absence : on
        // se tait, plutôt que d'accueillir quelqu'un qui vient d'arriver.
        if (previous === null) return
        const gap = diffDays(previous as IsoDate, today)
        if (gap < ABSENCE_DAYS) return
        setAbsence({ previous: previous as IsoDate, gap })
      },
      // L'écran de retour est un confort, pas une porte : si la RPC échoue,
      // l'application s'ouvre normalement et rien ne s'affiche.
      onError: () => setSettled(true),
    })
  }, [status, today, mutate])

  return { absence, isPending: !settled }
}
