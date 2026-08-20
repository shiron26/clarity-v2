// Arithmétique de dates sur des chaînes ISO `YYYY-MM-DD`, ancrée sur la date
// renvoyée par public.app_today() (fuseau de l'application, jamais celui du
// navigateur). Aucune fonction ici ne lit l'horloge locale : tout part d'une
// date passée en argument, ce qui les rend pures et testables.
//
// Semaine ISO : lundi → dimanche (SPEC §2).

export type IsoDate = string

function toUtc(date: IsoDate): Date {
  // Midi UTC : évite qu'un décalage de fuseau ne fasse basculer le jour.
  return new Date(`${date}T12:00:00Z`)
}

function fromUtc(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUtc(d)
}

/** Nombre de jours de `from` à `to` — négatif si `to` précède `from`. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
}

/** 1 = lundi … 7 = dimanche (numérotation ISO). */
export function isoWeekday(date: IsoDate): number {
  return toUtc(date).getUTCDay() || 7
}

export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - isoWeekday(date))
}

export function endOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 7 - isoWeekday(date))
}

/** Les 7 dates de la semaine contenant `date`, du lundi au dimanche. */
export function daysOfWeek(date: IsoDate): IsoDate[] {
  const monday = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export const ROLLING_WEEK_DAYS = 7

/**
 * Fenêtre glissante de sept jours : `date` et les six suivants.
 *
 * À ne pas confondre avec `daysOfWeek`, qui rend la semaine CALENDAIRE (lundi →
 * dimanche). Les deux coexistent et ne sont pas interchangeables : les objectifs
 * comptent en semaines ISO, et c'est le SERVEUR qui les indexe
 * (`private.credit_day`, `extract(isoweek …)`) — une fenêtre mobile là-dedans
 * désynchroniserait le front et la base. Une liste d'échéances, elle, n'a aucune
 * raison de rétrécir à un seul jour le dimanche.
 */
export function rollingWeek(date: IsoDate): IsoDate[] {
  return Array.from({ length: ROLLING_WEEK_DAYS }, (_, i) => addDays(date, i))
}

/** Dernier jour de la fenêtre glissante ouverte par `date`. */
export function rollingWeekEnd(date: IsoDate): IsoDate {
  return addDays(date, ROLLING_WEEK_DAYS - 1)
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`
}

/**
 * **Uniquement valide sur un premier du mois** — « 31 janvier + 1 mois » n'a pas de
 * réponse, et `Date` répondrait 3 mars. Les appelants passent tous par
 * `startOfMonth()` d'abord (`monthGrid`, navigation du calendrier), ce qui rend le
 * cas impossible par construction.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const d = toUtc(date)
  return fromUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12)))
}

export function sameMonth(a: IsoDate, b: IsoDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/**
 * Les 42 cases d'une grille de mois, à partir du lundi de la semaine contenant le
 * premier. Six semaines fixes (et non « autant que nécessaire ») : c'est ce qui
 * empêche le popover de changer de hauteur d'un mois à l'autre.
 */
export function monthGrid(date: IsoDate): IsoDate[] {
  const start = startOfWeek(startOfMonth(date))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/**
 * Année et numéro de semaine ISO. Algorithme standard : le jeudi de la semaine
 * détermine l'année, la semaine 1 est celle qui contient le premier jeudi.
 * Doit correspondre à `extract(isoyear|week from …)` côté Postgres.
 */
export type IsoWeek = { isoYear: number; isoWeek: number }

export function isoWeek(date: IsoDate): IsoWeek {
  const thursday = toUtc(addDays(date, 4 - isoWeekday(date)))
  const isoYear = thursday.getUTCFullYear()
  const jan1 = new Date(Date.UTC(isoYear, 0, 1, 12))
  const days = Math.round((thursday.getTime() - jan1.getTime()) / 86_400_000)
  return { isoYear, isoWeek: Math.floor(days / 7) + 1 }
}

export function year(date: IsoDate): number {
  return Number(date.slice(0, 4))
}

/** Trimestre civil (1–4) contenant `date`. */
export function quarterOf(date: IsoDate): number {
  return Math.ceil(Number(date.slice(5, 7)) / 3)
}

/** Premier et dernier jour du trimestre civil contenant `date`. */
export function quarterBounds(date: IsoDate): { from: IsoDate; to: IsoDate } {
  const y = year(date)
  const q = quarterOf(date)
  const firstMonth = (q - 1) * 3 + 1
  const from = `${y}-${String(firstMonth).padStart(2, '0')}-01`
  // Jour 0 du mois suivant le trimestre = dernier jour du trimestre.
  const to = fromUtc(new Date(Date.UTC(y, firstMonth + 2, 0, 12)))
  return { from, to }
}

/**
 * Premier jour du trimestre `quarter` de l'année `year` — l'ancre à passer aux
 * helpers de trimestre, qui prennent tous une date et non un couple
 * (année, trimestre). Sert à regarder un trimestre autre que le courant.
 */
export function quarterAnchor(year: number, quarter: number): IsoDate {
  const month = (quarter - 1) * 3 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Les semaines (lundis) qui couvrent le trimestre contenant `date` : la heatmap
 * affiche des colonnes pleines, donc on part du lundi de la semaine du 1er jour
 * du trimestre et on va jusqu'à celle de son dernier jour.
 */
export function weeksOfQuarter(date: IsoDate): IsoDate[] {
  const { from, to } = quarterBounds(date)
  const weeks: IsoDate[] = []
  for (let monday = startOfWeek(from); monday <= to; monday = addDays(monday, 7)) {
    weeks.push(monday)
  }
  return weeks
}

/** Premier et dernier jour de l'année civile de `date`. */
export function yearBounds(date: IsoDate): { from: IsoDate; to: IsoDate } {
  const y = year(date)
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

/** Rang de `date` dans son année : 1 pour le 1er janvier. */
export function dayOfYear(date: IsoDate): number {
  const jan1 = toUtc(`${year(date)}-01-01`)
  return Math.round((toUtc(date).getTime() - jan1.getTime()) / 86_400_000) + 1
}

/** Nombre de jours de l'année civile de `date` (365 ou 366). */
export function daysInYear(date: IsoDate): number {
  return dayOfYear(`${year(date)}-12-31`)
}

/**
 * Part de l'année écoulée, en pourcentage entier — une donnée calendaire, pas
 * une mesure de progression d'objectif (SPEC §1 proscrit les secondes).
 */
export function yearProgressPercent(date: IsoDate): number {
  return Math.round((dayOfYear(date) / daysInYear(date)) * 100)
}

/** Une semaine ISO, désignée sans ambiguïté. */
export type WeekRef = { isoYear: number; weekNo: number; monday: IsoDate }

/**
 * Les semaines d'un trimestre, chacune avec SON année ISO.
 *
 * L'année ne se déduit pas du trimestre : la semaine qui contient le 1er janvier
 * appartient parfois encore à l'année ISO précédente (le 1er janvier 2027 tombe
 * un vendredi ⇒ semaine 53 de 2026). C'est le couple (année ISO, numéro) qui
 * identifie une semaine partout où on l'indexe — relevés et reviews compris.
 */
export function weeksOfQuarterRefs(date: IsoDate): WeekRef[] {
  return weeksOfQuarter(date).map((monday) => {
    const { isoYear, isoWeek: weekNo } = isoWeek(monday)
    return { isoYear, weekNo, monday }
  })
}

// Les formats `Intl` sont **construits une fois**, jamais dans le corps des
// fonctions : `Intl.DateTimeFormat` est un objet coûteux à instancier, et
// `formatDayMonth` est appelé une fois par ligne de tâche.
const FMT = {
  shortDate: new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }),
  longDate: new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
  dayHeader: new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
  dayMonthLong: new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
  dayMonthLongYear: new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  dayMonth: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  monthYear: new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  monthShort: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }),
  dayNumber: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' }),
}

/** « lun. 4 août » — pour les échéances en retard. */
export function formatShortDate(date: IsoDate): string {
  return FMT.shortDate.format(toUtc(date))
}

/** « mercredi 13 août » — sous-titre de la vue « Aujourd'hui ». */
export function formatLongDate(date: IsoDate): string {
  return FMT.longDate.format(toUtc(date))
}

/**
 * « MER. 13 AOÛT » — en-tête de groupe de jour dans les vues multi-jours de
 * l'écran Tâches. La maquette écrit le jour abrégé et le mois en toutes lettres,
 * le tout en capitales : c'est `Intl` qui produit « mer. 13 août », le point
 * d'abréviation compris.
 */
export function formatDayHeader(date: IsoDate): string {
  return FMT.dayHeader.format(toUtc(date)).toUpperCase()
}

/**
 * Ancienneté d'un retard : « Hier », « Il y a 3 j ». Au-delà de six jours le
 * décompte ne dit plus rien d'utile — la date absolue reprend la main.
 */
export function formatOverdueDelay(date: IsoDate, today: IsoDate): string {
  const days = diffDays(date, today)
  if (days === 1) return 'Hier'
  if (days > 1 && days < 7) return `Il y a ${days} j`
  return formatShortDate(date)
}

/**
 * Ancienneté d'un élément, en forme courte : « 9 j », « 6 sem », « 1 an ».
 *
 * Le pendant calme de `formatOverdueDelay` : ici rien n'est en retard, on dit
 * seulement depuis quand la ligne attend. Le seuil de bascule est la semaine
 * pleine — « 9 j » se lit encore, « 77 j » ne se lit plus.
 */
export function formatAge(from: IsoDate, today: IsoDate): string {
  const days = diffDays(from, today)
  if (days < 14) return `${days} j`
  const weeks = Math.floor(days / 7)
  if (weeks < 52) return `${weeks} sem`
  const years = Math.floor(days / 365)
  return `${years} an${years > 1 ? 's' : ''}`
}

/** La même ancienneté en toutes lettres, pour l'infobulle et les lecteurs
 *  d'écran : « depuis 6 semaines ». */
export function formatAgeLong(from: IsoDate, today: IsoDate): string {
  const days = diffDays(from, today)
  if (days < 14) return `depuis ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks < 52) return `depuis ${weeks} semaines`
  const years = Math.floor(days / 365)
  return `depuis ${years} an${years > 1 ? 's' : ''}`
}

/**
 * « 3 décembre » — mois en toutes lettres, sans le jour de la semaine.
 *
 * La date d'une projection ne désigne pas un rendez-vous : dire « mercredi »
 * donnerait à une estimation la précision d'une échéance.
 */
export function formatDayMonthLong(date: IsoDate, reference?: IsoDate): string {
  // L'année n'apparaît que si elle diffère de celle de la référence. Sans ça,
  // une projection lointaine annonce « le 2 mai » sans dire lequel — et se lit
  // comme dans huit mois alors qu'elle est dans vingt.
  const withYear = reference !== undefined && year(date) !== year(reference)
  return (withYear ? FMT.dayMonthLongYear : FMT.dayMonthLong).format(toUtc(date))
}

/** « 13 août » — pastille de date d'une ligne de tâche. */
export function formatDayMonth(date: IsoDate): string {
  return FMT.dayMonth.format(toUtc(date))
}

/**
 * « Août 2026 » — titre d'une grille de mois. `Intl` rend « août 2026 » en
 * minuscule ; la capitale se pose à la main plutôt que par un second format.
 */
export function formatMonthYear(date: IsoDate): string {
  const label = FMT.monthYear.format(toUtc(date))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * En-têtes de colonnes d'une grille de mois, du lundi au dimanche.
 * Distinct de `WEEKDAYS` (`src/lib/recurrence.ts`), qui porte des lettres seules
 * (`L M M J V S D`) pour les pastilles de récurrence : deux alphabets, deux usages.
 */
export const WEEK_HEADERS: ReadonlyArray<{ short: string; long: string }> = [
  { short: 'LU', long: 'lundi' },
  { short: 'MA', long: 'mardi' },
  { short: 'ME', long: 'mercredi' },
  { short: 'JE', long: 'jeudi' },
  { short: 'VE', long: 'vendredi' },
  { short: 'SA', long: 'samedi' },
  { short: 'DI', long: 'dimanche' },
]

/**
 * « août » — le mois seul, sans point d'abréviation.
 *
 * `Intl` rend « juil. » / « sept. » ; la maquette écrit ces mois sans point.
 * Trois modules portaient leur propre `Intl.DateTimeFormat` et leur propre
 * `.replace('.', '')`, chacun avec sa conversion `T12:00:00Z` faite main.
 */
export function formatMonthShort(date: IsoDate): string {
  return FMT.monthShort.format(toUtc(date)).replace('.', '')
}

/** « 13 » — le quantième seul, pour les bornes d'une semaine. */
export function formatDayNumber(date: IsoDate): string {
  return FMT.dayNumber.format(toUtc(date))
}
