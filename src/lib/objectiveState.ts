// Les règles d'état d'un objectif à l'écran — pures, sans dépendance React.
//
// Séparées de `ObjectiveCard` parce qu'un fichier de composant ne doit exporter
// que des composants (le fast refresh perd le fil sinon), et parce que la règle
// ci-dessous est un choix produit, pas un détail de rendu : deux écrans la
// partagent déjà.
import type { Objective } from '../hooks/useObjectives'
import type { ObjectivePeriod } from '../hooks/useObjectivePeriods'

/**
 * Une carte s'allume-t-elle ?
 *
 * Deux garde-fous font toute la règle (REFONTE §3), et ce sont eux qui
 * transforment la désaturation en récompense plutôt qu'en reproche :
 *
 * - **seuls les objectifs à cadence se désaturent** — une quantité ou des jalons
 *   n'ont pas de rythme quotidien, les juger n'aurait pas d'objet ;
 * - **une semaine déjà complète reste allumée** — désaturer une semaine parfaite
 *   parce qu'on n'a rien fait un dimanche serait exactement le jugement
 *   quotidien que la refonte enlève.
 */
export function isObjectiveLit(input: {
  objective: Objective
  week: ObjectivePeriod | undefined
  activeToday: boolean
}): boolean {
  const { objective, week, activeToday } = input
  if (objective.closed_at !== null) return true
  if (objective.measure !== 'habitude') return true
  if (activeToday) return true
  // Semaine bouclée : la carte reste en couleur jusqu'à la période suivante.
  return !!week && week.done >= week.target
}

/** Nombre de crans de la rampe d'une grille de densité. */
export const HEAT_STEPS = 6

/**
 * L'intensité d'une période, de 0 (le cran le plus sombre) à 5 (le plus vif).
 *
 * **Ce n'est plus une série.** L'ancienne rampe encodait un streak — elle
 * montait à chaque période tenue et **retombait à zéro** dès qu'une période
 * échouait, ce qui repeignait tout ce qui suivait un trou. C'est exactement la
 * mesure que la refonte supprime (§0.1). Ici chaque période ne dépend que
 * d'elle-même : rater une semaine ne décolore plus les suivantes.
 *
 * `target <= 0` rend le cran plein plutôt que zéro : rien n'était attendu, on ne
 * peut donc pas être « sous » l'attente. Même doctrine que `regularityPercent`
 * ci-dessous, qui rend `null` plutôt que `0 %`.
 */
export function heatLevel(done: number, target: number): number {
  if (done <= 0) return 0
  if (target <= 0) return HEAT_STEPS - 1
  return Math.min(HEAT_STEPS - 1, Math.floor((done / target) * HEAT_STEPS))
}

/**
 * Combien de JOURS distincts ont été crédités, dans un jeu de clés
 * `objectifId|jour` — la forme rendue par `useObjectiveActiveDays`.
 *
 * Un jour où l'on a avancé sur trois objectifs reste **un** jour : l'unité
 * mesurée est la journée, pas l'effort. C'est exactement ce que compte
 * `objective_period.done` côté serveur, et le compteur qui ouvre le bilan annuel
 * (§8) comme l'écran de retour (§9) doivent dire le même chiffre — d'où une seule
 * implémentation ici plutôt qu'une par cérémonie.
 */
/**
 * Clé d'appartenance d'un jour crédité : `objectifId|jour`.
 *
 * Exactement la forme que rend `public.objective_active_days` — c'est ce qui
 * permet de tester « ce jour compte-t-il ? » sans second aller-retour. Ici, dans
 * le module qui la **relit** (`distinctDays` juste dessous) : le format avait
 * trois producteurs et un lecteur, il n'a plus qu'une définition.
 */
export function sessionKey(objectiveId: string, day: string): string {
  return `${objectiveId}|${day}`
}

export function distinctDays(keys: Set<string>): number {
  const days = new Set<string>()
  for (const key of keys) {
    const day = key.slice(key.indexOf('|') + 1)
    if (day) days.add(day)
  }
  return days.size
}

/**
 * Part de l'attendu qui a été tenue, en pourcentage entier — ou `null` quand
 * rien n'était attendu (objectif trop jeune, périodes de clôture absentes du
 * relevé). `null` se lit « pas encore de mesure », jamais « 0 % ».
 *
 * Ici et non dans `useObjectiveRegularity` : c'est une règle de lecture pure, de
 * la même famille que `heatLevel` juste au-dessus, et la laisser dans un module
 * de hook obligeait les modules purs qui l'emploient à traîner le client
 * supabase avec elle.
 */
export function regularityPercent(done: number, target: number): number | null {
  if (target <= 0) return null
  return Math.round((done / target) * 100)
}

/**
 * Part accomplie d'un décompte qui part de zéro — des séances faites sur une
 * cible totale, des étapes franchies sur les étapes posées.
 *
 * Bornée **des deux côtés**, et la borne basse n'est pas décorative : une
 * largeur CSS négative est ignorée, la barre resterait vide sans que rien ne
 * dise pourquoi.
 */
export function targetPercent(done: number, target: number): number | null {
  if (target <= 0) return null
  return clampPercent((done / target) * 100)
}

/**
 * Part accomplie d'un objectif quantifié — et c'est la seule des deux qui a un
 * SENS et une ORIGINE.
 *
 * Le produit a longtemps lu la progression d'une quantité comme `valeur / cible`,
 * c'est-à-dire une montée depuis zéro. Deux hypothèses y étaient enfouies, et
 * les deux sont fausses dès qu'on relève une valeur plutôt que d'incrémenter :
 *
 * - **le sens.** « Perdre du poids », 78 kg vers 70, donnait 111 % — borné à
 *   100, donc « cible atteinte » le jour de la création. C'est exactement ce que
 *   `direction` décrit, et elle n'était lue nulle part.
 * - **l'origine.** Même à la hausse, un relevé qui part de 82 kg vers 90
 *   démarrait à 91 % sans que rien n'ait été fait. La progression d'un relevé se
 *   mesure sur la distance `départ → cible`, pas sur la cible seule.
 *
 * Un cumul part de 0 en `'atteindre'` : la formule s'y réduit à `valeur / cible`,
 * ce que l'existant affichait déjà.
 *
 * `null` quand il n'y a **rien à parcourir** (départ égal à la cible, ou du
 * mauvais côté) : la barre disparaît alors plutôt que d'afficher un 0 % ou un
 * 100 % qui ne veulent rien dire.
 */
export function quantityPercent(
  objective: Pick<Objective, 'direction' | 'target_value' | 'start_value'>,
  value: number,
): number | null {
  const target = objective.target_value
  if (target === null) return null
  const start = objective.start_value ?? 0
  const down = objective.direction === 'sous'

  const span = down ? start - target : target - start
  if (span <= 0) return null
  const done = down ? start - value : value - start
  return clampPercent((done / span) * 100)
}

/** 0 à 100, entier : une barre ne déborde de son rail ni d'un côté ni de l'autre. */
function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)))
}

/**
 * Les secondaires en dernier — l'ordre de tous les tableaux et frises du produit.
 *
 * `sort` est stable : l'ordre que `useObjectives` a déjà établi tient à
 * l'intérieur de chaque rang, ce qui suffit à rendre l'affichage déterministe
 * sans second critère.
 */
export function bySecondaryLast(a: Objective, b: Objective): number {
  return Number(a.kind === 'secondaire') - Number(b.kind === 'secondaire')
}
