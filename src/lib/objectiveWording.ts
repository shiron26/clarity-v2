// Comment un objectif se dit à l'écran — sa cadence, sa nature, sa fenêtre, ses
// montants.
//
// Ces libellés vivent dans `src/lib/` et non dans `features/objectives/` parce
// que `ObjectiveCard` est un composant PARTAGÉ (dashboard, écran Tâches,
// célébration) : un composant de `src/components/` ne peut pas importer d'une
// feature (AGENTS.md). Ils sont purs, sans dépendance React.
import { formatDayMonthLong } from './appDate'
import type { Objective } from '../hooks/useObjectives'
import type { PeriodUnit } from '../hooks/useObjectivePeriods'

/**
 * « Quotidien » n'est pas un cas particulier, c'est simplement 7 (SPEC §4.1) —
 * mais seulement quand la période est la semaine : depuis que la cadence peut
 * être mensuelle (REFONTE §1.2), sept fois par mois n'a rien de quotidien.
 */
export function cadenceLabel(cadence: number | null, unit: PeriodUnit | null = 'week'): string {
  if (cadence === null) return ''
  if (unit === 'month') return `${cadence}×/mois`
  return cadence === 7 ? 'Quotidien' : `${cadence}×/semaine`
}

/**
 * « Semaine » ou « Mois » — la période de l'objectif, telle que la carte la
 * porte en pastille.
 *
 * L'indicateur de la carte est muet sur son échelle : « 1/3 » ne dit pas si ces
 * trois fois sont attendues dans la semaine ou dans le mois, et les deux
 * existent depuis que la cadence peut être mensuelle (REFONTE §1.2). Ce sont les
 * deux mots exacts de la question posée à la création, pas une paraphrase.
 *
 * Rien pour des étapes : elles n'ont pas de période (`period_unit` est nulle),
 * et inventer un mot ferait croire à un rythme qu'on ne leur demande pas.
 */
export function periodLabel(unit: PeriodUnit | null): string | null {
  if (unit === null) return null
  return unit === 'month' ? 'Mois' : 'Semaine'
}

/** « Année » ou « T3 » — la fenêtre de l'objectif, telle qu'on la porte en badge. */
export function windowLabel(objective: Pick<Objective, 'quarter'>): string {
  return objective.quarter === null ? 'Année' : `T${objective.quarter}`
}

/**
 * La ligne sous le titre : ce que l'objectif demande, jamais où il en est.
 *
 * « Habitude · 3×/semaine » · « Relevé mensuel » · « Étapes · T3 ». Chaque mesure
 * a son vocabulaire — c'est ce qui évite de faire lire une quantité comme une
 * cadence ratée.
 */
export function objectiveSubtitle(
  objective: Pick<Objective, 'measure' | 'cadence' | 'period_unit' | 'quarter'>,
): string {
  if (objective.measure === 'habitude') {
    return `Habitude · ${cadenceLabel(objective.cadence, objective.period_unit)}`
  }
  if (objective.measure === 'quantite') {
    return objective.period_unit === 'month' ? 'Relevé mensuel' : 'Relevé hebdomadaire'
  }
  return `Étapes · ${windowLabel(objective)}`
}

/**
 * « arrêté le 18 février » — le tag d'un objectif qui s'est interrompu avant la
 * fin de sa fenêtre.
 *
 * « Arrêté », jamais « échoué » (REFONTE §6) : la frise raconte l'année, et deux
 * mois portés sont deux mois de travail réel. C'est le vocabulaire que
 * `objectiveWindow.ts` emploie déjà pour `closed_at`.
 */
export function closureLabel(closedAt: string): string {
  return `arrêté le ${formatDayMonthLong(closedAt.slice(0, 10))}`
}

/**
 * Ce que l'édition ne peut **pas** changer, en une ligne : « Objectif principal ·
 * relevé mensuel · année 2026 ».
 *
 * « Principal » et non « de front » : le second était une invention maison que
 * rien n'expliquait, quand le premier fait la paire évidente avec « secondaire ».
 *
 * Distincte d'`objectiveSubtitle`, et il le faut : celle-ci porte la cadence,
 * qui est modifiable juste en dessous dans le formulaire — la ligne se
 * contredirait en direct à la première frappe.
 */
export function objectiveIdentityLine(
  objective: Pick<
    Objective,
    'kind' | 'measure' | 'period_unit' | 'entry_mode' | 'quarter' | 'year'
  >,
): string {
  const parts: string[] = [
    objective.kind === 'secondaire' ? 'Objectif secondaire' : 'Objectif principal',
  ]

  const monthly = objective.period_unit === 'month'
  if (objective.measure === 'habitude') {
    parts.push(monthly ? 'habitude mensuelle' : 'habitude hebdomadaire')
  } else if (objective.measure === 'quantite') {
    const mode = objective.entry_mode === 'cumul' ? 'cumul' : 'relevé'
    parts.push(`${mode} ${monthly ? 'mensuel' : 'hebdomadaire'}`)
  } else {
    parts.push('étapes')
  }

  parts.push(
    objective.quarter === null ? `année ${objective.year}` : `T${objective.quarter} ${objective.year}`,
  )
  return parts.join(' · ')
}

const AMOUNT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

/**
 * « 4 400 € » — séparateur de milliers français, unité en suffixe et jamais
 * collée. Sans unité, c'est un compteur nu : la valeur seule.
 */
export function formatQuantity(value: number | null, unit: string | null): string {
  if (value === null) return '—'
  const amount = AMOUNT.format(value)
  return unit ? `${amount} ${unit}` : amount
}

