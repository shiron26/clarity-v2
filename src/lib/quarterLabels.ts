// Comment un trimestre se nomme et s'adresse.
//
// Dans `src/lib/` et non dans `features/year/` : l'écran Année nomme ses quatre
// trimestres, et le bilan (§8) nomme celui qu'il conclut comme celui qui vient.
// Une feature n'importe jamais d'une autre (AGENTS.md), donc ce qui sert aux deux
// remonte ici. Fonctions pures, aucun accès au calendrier — les bornes de date
// vivent dans `appDate.ts`.

/** Les quatre trimestres, dans l'ordre — l'axe de l'écran Année. */
export const QUARTERS = [1, 2, 3, 4]

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/**
 * « juillet → septembre ».
 *
 * En toutes lettres et non « T3 » seul : le numéro de trimestre est déjà sur
 * l'onglet, ce qui manque à côté c'est de quels mois on parle.
 */
export function quarterRangeLabel(quarter: number): string {
  const first = (quarter - 1) * 3
  return `${MONTHS[first]} → ${MONTHS[first + 2]}`
}

/**
 * « Trimestre 3 » — écrit, jamais abrégé.
 *
 * `T3` est une forme de badge : elle ne se justifie que là où la place manque,
 * comme le sur-titre d'un deck de cérémonie. Sur une carte, rien ne presse.
 */
export function quarterFullLabel(quarter: number): string {
  return `Trimestre ${quarter}`
}

/**
 * « Trimestre 3 · en cours » sur le trimestre vivant, « Trimestre 3 » sinon.
 *
 * Le libellé d'un onglet du hub de rituel. Écrit et non `T3` : l'abréviation est
 * un badge, elle ne se justifie que là où la place manque vraiment.
 */
export function quarterTabLabel(quarter: number, currentQuarter: number | undefined): string {
  return quarter === currentQuarter
    ? `${quarterFullLabel(quarter)} · en cours`
    : quarterFullLabel(quarter)
}

/** `/annee/2026/t3` — l'adresse du détail d'un trimestre. */
export function quarterPath(year: number, quarter: number): string {
  return `/annee/${year}/t${quarter}`
}

/** `t3` → `3`. Rend `null` sur tout le reste : l'URL n'est pas de confiance. */
export function parseQuarterParam(param: string | undefined): number | null {
  const match = /^t([1-4])$/.exec(param ?? '')
  return match ? Number(match[1]) : null
}

/**
 * La période que conclut une cérémonie de bilan.
 *
 * Le trimestre et l'année sont **deux cérémonies distinctes** (SPEC §4.4 : le
 * dernier vendredi de décembre en porte plusieurs, séparément), mais elles
 * partagent leur coquille et leur page. Un seul segment d'URL les distingue, donc
 * un seul paramètre de route — deux routes feraient dépendre le résultat de
 * l'ordre de déclaration, `annee` matchant aussi bien `:period`.
 */
export type BilanPeriod = { type: 'quarter'; quarter: number } | { type: 'year' }

/** `/bilan/2026/t3` · `/bilan/2026/annee` — l'adresse d'une cérémonie de bilan. */
export function bilanPath(year: number, period: BilanPeriod): string {
  return period.type === 'year'
    ? `/bilan/${year}/annee`
    : `/bilan/${year}/t${period.quarter}`
}

/** `t1`…`t4` ou `annee`. Rend `null` sur tout le reste — l'URL n'est pas de confiance. */
export function parseBilanParam(param: string | undefined): BilanPeriod | null {
  if (param === 'annee') return { type: 'year' }
  const quarter = parseQuarterParam(param)
  return quarter === null ? null : { type: 'quarter', quarter }
}
