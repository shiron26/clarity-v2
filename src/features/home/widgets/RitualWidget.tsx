import { useMemo } from 'react'
import { useObjectives, selectPrincipals } from '../../../hooks/useObjectives'
import { useRitualWeek } from '../../../hooks/useRitualWeek'
import { objectivesForWeek } from '../../../lib/reviewPeriod'
import { isoWeek, isoWeekday, startOfWeek, year as yearOf } from '../../../lib/appDate'
import { useDashboardCtx } from '../dashboardContext'
import { RitualCard } from '../components/RitualCard'

// Le rituel ouvre le vendredi (jour ISO 5).
const RITUAL_WEEKDAY = 5

/**
 * Le rendez-vous du vendredi.
 *
 * C'était un encart imposé en tête de page ; c'est devenu un widget qu'on pose ou
 * qu'on retire. Le seuil des deux jours qui le gardait muet le reste de la semaine
 * a disparu avec l'encart : il existait pour qu'un bloc imposé ne devienne pas du
 * bruit de fond, et un widget qu'on a soi-même mis là n'a pas ce problème. Une
 * carte qui s'effacerait quatre jours sur sept laisserait surtout un trou dans la
 * grille.
 *
 * Le bilan de trimestre, lui, reste épinglé par la page : il se périme, on ne le
 * rattrape pas. Tant qu'il attend, la page tait ce widget (`hidden`) pour ne pas
 * afficher deux rendez-vous à la fois.
 */
export function RitualWidget() {
  const { today } = useDashboardCtx()
  const ritual = useRitualWeek()
  const objectivesQuery = useObjectives(yearOf(today))

  // La semaine à passer en revue : celle que le hook désigne quand un rituel
  // attend, la semaine en cours sinon — avant vendredi, aucune session n'existe.
  const week = ritual.pending ?? currentWeek(today)
  const objectiveCount = useMemo(
    () => objectivesForWeek(selectPrincipals(objectivesQuery.data), week.start).length,
    [objectivesQuery.data, week.start],
  )

  return (
    <RitualCard
      weekNo={week.week.isoWeek}
      weekStart={week.start}
      objectiveCount={objectiveCount}
      open={ritual.pending !== null}
      // Compté depuis la date SERVEUR : un compte à rebours qui lirait l'horloge du
      // navigateur annoncerait autre chose que l'ouverture réelle.
      daysUntil={(RITUAL_WEEKDAY - isoWeekday(today) + 7) % 7}
      lastNotedWeek={ritual.previous?.review?.validated_at ? ritual.previous.start : undefined}
    />
  )
}

function currentWeek(today: string) {
  const start = startOfWeek(today)
  return { week: isoWeek(start), start }
}
