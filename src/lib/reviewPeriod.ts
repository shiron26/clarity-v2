// Vocabulaire et arithmétique des périodes de review. Fonctions pures : aucune
// ne lit l'horloge, tout dérive de l'ancre serveur passée par l'écran.
//
// Dans `src/lib/` et non dans `features/review/` : l'encart de rituel du
// dashboard compte les objectifs d'une période avec `objectivesForPeriod`, et
// une feature n'importe jamais d'une autre (AGENTS.md).
import { addDays, formatDayNumber, formatMonthShort, type IsoDate } from './appDate'
import { windowEnd, windowStart } from './objectiveFeasibility'
import type { Objective } from '../hooks/useObjectives'


/**
 * « 10 – 16 août » quand la semaine tient dans un mois, « 27 juil – 2 août »
 * quand elle l'enjambe.
 */
export function weekDatesLabel(monday: IsoDate): string {
  const sunday = addDays(monday, 6)
  const from = formatMonthShort(monday)
  const to = formatMonthShort(sunday)
  return from === to
    ? `${formatDayNumber(monday)} – ${formatDayNumber(sunday)} ${to}`
    : `${formatDayNumber(monday)} ${from} – ${formatDayNumber(sunday)} ${to}`
}

// Sans `timeZone` — contrairement au reste du module : ce format reçoit un
// instant, pas un jour applicatif, et l'ouverture se lit dans le fuseau du
// lecteur. Construit une fois, comme les formats d'`appDate`.
const OPENING_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** « 25 sept » — la date d'ouverture affichée sur une pastille verrouillée. */
export function openingDateLabel(openAt: string): string {
  return OPENING_DATE.format(new Date(openAt)).replace('.', '')
}

/**
 * « Semaine 33 · en cours » quand c'est celle qu'on vit, « Semaine 33 » sinon.
 *
 * Le numéro seul ne situe personne : la mention « en cours » est ce qui distingue
 * la semaine où l'on est de douze autres qui se ressemblent.
 */
export function weekTitle(weekNo: number, currentWeekNo: number | undefined): string {
  return weekNo === currentWeekNo ? `Semaine ${weekNo} · en cours` : `Semaine ${weekNo}`
}

export type ReviewStatus = {
  /** « Validé le 28 juin » · « S'ouvre le 25 sept » · « Ouvert, à faire ». */
  meta: string
  cta: string
  /** `false` ⇒ texte inerte, jamais un lien mort. */
  actionable: boolean
  /**
   * Pourquoi cet état. Deux appelants rendent différemment un bilan verrouillé
   * (un cadenas, la date d'ouverture est déjà écrite) et un trimestre sans
   * objectif (rien à verrouiller, il n'y avait rien) : sans ce discriminant, ils
   * comparaient la chaîne du `cta`, ce qui casse au premier changement de copie.
   */
  reason: 'done' | 'open' | 'empty' | 'locked'
}

/**
 * L'état réel du bilan, énoncé au lieu d'être découvert au clic.
 *
 * Quatre états, jamais deux à la fois. La date vient du serveur
 * (`review_openings`) : c'est lui qui connaît le fuseau.
 *
 * `hasSubjects` est ce qui empêche d'ouvrir une cérémonie sans sujet. Les
 * ouvertures sont **globales** — le serveur ne sait pas depuis quand un compte
 * existe — donc T1 est « ouvert » depuis mars pour quelqu'un arrivé en août, et
 * son bilan se proposait alors qu'`objectivesForQuarter` n'y met personne.
 *
 * Dans `src/lib/` et non dans `features/year/` : l'en-tête du trimestre et la
 * pastille du hub de rituel disent tous deux où en est le bilan, et une feature
 * n'importe jamais d'une autre (AGENTS.md).
 */
export function reviewStatus(input: {
  openAt: string | undefined
  isOpen: boolean
  validatedAt: string | null
  /** La période a-t-elle porté quelque chose ? Omis = oui. */
  hasSubjects?: boolean
}): ReviewStatus {
  // Un bilan déjà validé reste traversable quoi qu'il arrive (SPEC §4.4) : ce
  // test passe avant celui du sujet, sinon une période vidée après coup rendrait
  // son propre bilan inatteignable.
  if (input.validatedAt !== null) {
    return {
      meta: `Validé le ${openingDateLabel(input.validatedAt)}`,
      cta: 'Revoir',
      actionable: true,
      reason: 'done',
    }
  }
  if (input.hasSubjects === false) {
    return { meta: 'Aucun objectif porté', cta: 'Rien à revoir', actionable: false, reason: 'empty' }
  }
  if (input.isOpen) {
    return { meta: 'Ouvert, à faire', cta: 'Commencer', actionable: true, reason: 'open' }
  }
  return {
    meta: input.openAt ? `S’ouvre le ${openingDateLabel(input.openAt)}` : 'Pas encore ouvert',
    cta: 'Bientôt',
    actionable: false,
    reason: 'locked',
  }
}

/**
 * Les objectifs qu'une période met au jugement.
 *
 * SPEC §3 : `closed_at IS NULL OR closed_at >= début de la période`. La période
 * en cours au moment de la clôture inclut l'objectif une dernière fois ; celles
 * qui commencent après ne le voient plus. Non implémentée en SQL, la règle est
 * donc appliquée ici — et nulle part ailleurs.
 */
export function objectivesForPeriod(
  objectives: Objective[],
  start: IsoDate,
): Objective[] {
  const startInstant = `${start}T00:00:00`
  return objectives.filter((o) => o.closed_at === null || o.closed_at >= startInstant)
}

/**
 * L'objectif existait-il avant la fin de la période ?
 *
 * Sans cette borne, un compte créé un mardi se voit proposer le rituel de la
 * semaine d'avant : la fenêtre `(year, quarter)` d'un objectif de T3 couvre tout
 * le trimestre, celle d'un annuel toute l'année, y compris les semaines
 * antérieures à sa création. Noter une semaine qui n'a pas eu lieu, c'est
 * exactement la dette que le rituel enlève (REFONTE §7).
 *
 * C'est la règle du serveur, reprise telle quelle : le backfill des périodes part
 * de `private.app_day(o.created_at)`, donc `objective_period` n'a aucune ligne
 * avant la création. Le seuil est la FIN de la période : un objectif créé un
 * mercredi est bien passé en revue le lundi suivant, sur les jours vécus.
 *
 * Comparaison sur la partie date, comme `heatmapWindow` le fait pour `closed_at` :
 * un `timestamptz` sérialisé porte son décalage de fuseau, le comparer
 * lexicalement à un instant naïf trébucherait dessus. `created_at` nulle (colonne
 * de vue) ne masque jamais rien — une date inconnue n'est pas une absence.
 */
function existedBy(objective: { created_at: string | null }, lastDay: IsoDate): boolean {
  return objective.created_at === null || objective.created_at.slice(0, 10) <= lastDay
}

/**
 * Les objectifs qu'une SEMAINE met au rituel : la règle de clôture ci-dessus,
 * **plus le chevauchement de fenêtre**, **plus l'existence**.
 *
 * Le second filtre n'existait pas avant la refonte, et il n'est pas optionnel :
 * depuis §1.1 une fenêtre peut être trimestrielle, et la clôture est un
 * événement indépendant qui peut survenir bien après la fin de la fenêtre. Sans
 * lui, un objectif de T2 clôturé en août réapparaît dans le rituel d'août à
 * « 0/2 » — soit un échec affiché pour une fenêtre terminée depuis juillet,
 * exactement le reproche que la refonte enlève.
 *
 * Bornes `[début, fin)`, comme `private.objective_window()`.
 */
export function objectivesForWeek(objectives: Objective[], monday: IsoDate): Objective[] {
  const sunday = addDays(monday, 6)
  return objectivesForPeriod(objectives, monday).filter(
    (o) =>
      windowStart(o.year, o.quarter) <= sunday &&
      monday < windowEnd(o.year, o.quarter) &&
      existedBy(o, sunday),
  )
}

/**
 * Les objectifs qu'un TRIMESTRE met au bilan : la règle de clôture, **plus le
 * chevauchement de fenêtre**, **plus l'existence** — même raisonnement que
 * `objectivesForWeek`, jusqu'à la borne de création : quelqu'un qui arrive le
 * 2 octobre n'a pas de verdict à rendre sur T3.
 *
 * Sans le second filtre, le bilan de T2 demanderait un verdict sur un objectif
 * de T3, c'est-à-dire un jugement sur un trimestre que l'objectif n'a pas vécu.
 * La règle de clôture seule ne suffit pas : elle ne regarde que `closed_at`, qui
 * est un événement indépendant de la fenêtre.
 *
 * Bornes `[début, fin)`, comme `private.objective_window()`.
 */
export function objectivesForQuarter(
  objectives: Objective[],
  year: number,
  quarter: number,
): Objective[] {
  const from = windowStart(year, quarter)
  const to = windowEnd(year, quarter)
  const lastDay = addDays(to, -1)
  return objectivesForPeriod(objectives, from).filter(
    (o) =>
      windowStart(o.year, o.quarter) < to &&
      from < windowEnd(o.year, o.quarter) &&
      existedBy(o, lastDay),
  )
}
