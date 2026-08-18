// Ce que l'écran de retour dit, et à qui il propose quelque chose.
//
// Module pur, sans JSX ni I/O — le pendant de `ritualContent.ts` (§7) et de
// `bilanContent.ts` (§8). Les decks reçoivent des chaînes déjà formées et rendent
// des gestes ; les deux décisions du lot vivent ici.
import { formatQuantity } from '../../lib/objectiveWording'
import { type ObjectiveRegularity } from '../../hooks/useObjectiveRegularity'
import { quantityPercent, regularityPercent } from '../../lib/objectiveState'
import type { Milestone } from '../../hooks/useMilestones'
import type { Objective } from '../../hooks/useObjectives'
import type { ObjectiveProgress } from '../../hooks/useObjectiveProgress'

/**
 * En dessous de ce seuil, le rythme déclaré n'a pas tenu sur les quatre dernières
 * périodes closes — la moitié de l'attendu, c'est-à-dire deux périodes vides sur
 * quatre. Au-dessus, l'objectif se rattrape tout seul en une période ou deux et
 * proposer d'alléger serait prématuré.
 */
const REGULARITY_FLOOR = 50

/** « Douze jours sans ouvrir n'y changent rien. » — l'absence en incise, jamais en titre. */
export function absenceLine(gap: number): string {
  if (gap >= 60) {
    const months = Math.round(gap / 30)
    return `${months} mois sans ouvrir n’y changent rien.`
  }
  if (gap >= 14) {
    const weeks = Math.floor(gap / 7)
    return `${weeks} semaines sans ouvrir n’y changent rien.`
  }
  return `${gap} jours sans ouvrir n’y changent rien.`
}

export type ComebackLine = {
  objective: Objective
  /** Le chiffre à droite : « 71 % », « 4 400 € », « 2 / 4 ». */
  value: string
  /**
   * 0–100 pour une barre, `null` pour des pastilles. Une barre sous-entend une
   * pression du temps qui n'existe pas pour des étapes.
   */
  percent: number | null
  /** Étapes franchies / posées — seulement pour les jalons. */
  steps: { done: number; total: number } | null
  /** Le rythme n'a pas tenu : le chiffre passe en accent plutôt qu'en gris. */
  behind: boolean
}

/**
 * L'état de chaque objectif au retour — **ce qui a bougé, pas ce qui manque**.
 *
 * Chaque mesure a son chiffre : une habitude se mesure à sa régularité, une
 * quantité à sa valeur, des jalons à leurs étapes. Les ramener toutes à un
 * pourcentage ferait lire une quantité comme un rythme raté.
 */
export function comebackLines(input: {
  objectives: Objective[]
  regularity: Map<string, ObjectiveRegularity>
  progress: Map<string, ObjectiveProgress>
  milestones: Milestone[]
}): ComebackLine[] {
  return input.objectives.map((objective) => {
    if (objective.measure === 'habitude') {
      const row = input.regularity.get(objective.id)
      const percent = row ? regularityPercent(row.done, row.target) : null
      return {
        objective,
        // `null` se lit « pas encore de mesure », jamais « 0 % » : un objectif
        // trop jeune n'a pas démérité.
        value: percent === null ? '—' : `${percent} %`,
        percent,
        steps: null,
        behind: percent !== null && percent < REGULARITY_FLOOR,
      }
    }

    if (objective.measure === 'quantite') {
      const value = input.progress.get(objective.id)?.value ?? 0
      return {
        objective,
        value: formatQuantity(value, objective.unit),
        percent: quantityPercent(objective, value),
        steps: null,
        // Une quantité n'a pas de rythme quotidien : rien à reprocher, jamais
        // d'accent. C'est la même doctrine que la carte qui ne se désature pas.
        behind: false,
      }
    }

    const own = input.milestones.filter((m) => m.objective_id === objective.id)
    const done = own.filter((m) => m.completed_at !== null).length
    return {
      objective,
      value: `${done} / ${own.length}`,
      percent: null,
      steps: { done, total: own.length },
      behind: false,
    }
  })
}

export type CadenceOffer = {
  objective: Objective
  from: number
  to: number
}

/**
 * À qui proposer d'alléger le rythme.
 *
 * Changer un réglage **est** une décision, et dans ce produit une décision mérite
 * son écran. On ne le propose donc que là où il veut dire quelque chose : une
 * habitude — seule mesure qui porte une cadence —, dont le rythme n'a pas tenu, et
 * qui a de la marge pour descendre. Une cadence de 1 n'a nulle part où aller, et
 * proposer 0 reviendrait à proposer d'arrêter, ce qui est un autre geste.
 *
 * Le repli à 100 quand `regularityPercent` rend `null` n'est pas un défaut : un
 * objectif trop jeune n'a pas encore de mesure, et on n'allège pas ce qu'on n'a
 * pas mesuré.
 */
export function cadenceOffers(
  objectives: Objective[],
  regularity: Map<string, ObjectiveRegularity>,
): CadenceOffer[] {
  const offers: CadenceOffer[] = []
  for (const objective of objectives) {
    if (objective.measure !== 'habitude') continue
    const cadence = objective.cadence
    if (cadence === null || cadence < 2) continue
    // Un objectif arrêté ne se réajuste pas : il n'attend plus rien.
    if (objective.closed_at !== null) continue

    const row = regularity.get(objective.id)
    const percent = row ? regularityPercent(row.done, row.target) : null
    if ((percent ?? 100) >= REGULARITY_FLOOR) continue

    offers.push({ objective, from: cadence, to: cadence - 1 })
  }
  return offers
}

/** « Votre cible de 100 séances ne change pas. » — la seule crainte réelle, traitée. */
export function targetReassurance(objective: Objective): string {
  return objective.target_value === null
    ? 'Votre objectif ne change pas, seul son rythme.'
    : `Votre cible de ${formatQuantity(objective.target_value, null)} séances ne change pas.`
}

/** « séances par semaine ? » / « séances par mois ? » — la question, telle quelle. */
export function cadenceQuestion(objective: Objective): string {
  return objective.period_unit === 'month' ? 'séances par mois' : 'séances par semaine'
}
