// Quel trimestre l'écran Objectifs montre-t-il, et sur quelles semaines ?
//
// La refonte (§4) **retire le sélecteur de trimestre** de cet écran : l'histoire
// complète se consulte sur l'écran Année (§6). Ici le trimestre n'est pas choisi,
// il est déduit — ce qui supprime un état d'interface et, surtout, garantit
// qu'on regarde toujours la période où l'objectif a effectivement vécu.
//
// Fonctions pures sur des `IsoDate`. « Aujourd'hui » vient du serveur
// (`useAppToday`), jamais de l'horloge du navigateur.
import { addDays, quarterAnchor, quarterOf, startOfWeek, weeksOfQuarter, type IsoDate } from './appDate'
import { windowEnd, windowStart } from './objectiveFeasibility'

type WindowedObjective = {
  year: number
  quarter: number | null
  closed_at: string | null
}

/**
 * Le trimestre à afficher : celui d'aujourd'hui si l'objectif le couvre encore,
 * sinon le **dernier trimestre de sa fenêtre**.
 *
 * C'est ce qui fait qu'un objectif de T1 arrêté en février affiche
 * « Régularité · T1 » et non « Régularité · T3 » : montrer le trimestre courant
 * d'un objectif qui n'y était pas afficherait une grille vide, et une grille
 * vide se lit comme un abandon.
 */
function displayedQuarter(objective: WindowedObjective, today: IsoDate): number {
  const start = windowStart(objective.year, objective.quarter)
  const end = windowEnd(objective.year, objective.quarter)

  if (today < start) return quarterOf(start)
  if (today < end) return quarterOf(today)
  // Fin de fenêtre EXCLUSIVE : reculer d'un jour pour retomber dedans.
  return quarterOf(addDays(end, -1))
}

/**
 * Les colonnes de la grille de densité : les semaines du trimestre affiché,
 * **tronquées à la date d'arrêt**.
 *
 * Un objectif arrêté le 18 février ne montre pas six semaines de vide après
 * lui : sa frise s'arrête là où la personne s'est arrêtée. Le vide qui suit
 * n'est pas une information, c'est un reproche sans objet.
 */
export function heatmapWindow(
  objective: WindowedObjective,
  today: IsoDate,
): { quarter: number; weeks: IsoDate[] } {
  const quarter = displayedQuarter(objective, today)
  const all = weeksOfQuarter(quarterAnchor(objective.year, quarter))

  const stop = objective.closed_at?.slice(0, 10)
  if (!stop) return { quarter, weeks: all }

  // La semaine de l'arrêt reste entière : elle a été vécue, la couper en son
  // milieu ferait disparaître des séances réellement faites.
  const lastMonday = startOfWeek(stop)
  const weeks = all.filter((monday) => monday <= lastMonday)
  return { quarter, weeks: weeks.length > 0 ? weeks : all.slice(0, 1) }
}

/**
 * La plage de jours à demander à `objective_active_days` pour remplir ces
 * colonnes. Elle déborde le trimestre civil : la première colonne commence au
 * lundi de la semaine du 1er, qui peut appartenir au trimestre précédent.
 */
export function heatmapRange(weeks: IsoDate[]): { from: IsoDate; to: IsoDate } | undefined {
  const first = weeks[0]
  const last = weeks[weeks.length - 1]
  if (!first || !last) return undefined
  return { from: first, to: addDays(last, 6) }
}
