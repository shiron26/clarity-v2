// Ce que l'écran Année dit de ses trimestres : l'état de leur bilan, et ce qu'ils
// annoncent quand ils n'ont rien à montrer.
//
// Même patron que `features/objectives/heroContent.ts` : ce module décide et
// formate, les bandes qui l'affichent sont muettes.
//
// Les libellés et l'adressage d'un trimestre ont depuis rejoint
// `src/lib/quarterLabels.ts`, et l'état d'un bilan `src/lib/reviewPeriod.ts` :
// le bilan (§8) les nomme aussi, le hub du rituel énonce le même verrou, et une
// feature n'importe jamais d'une autre.

const MONTHS_SHORT = [
  ['Jan', 'Fév', 'Mar'],
  ['Avr', 'Mai', 'Juin'],
  ['Juil', 'Août', 'Sep'],
  ['Oct', 'Nov', 'Déc'],
]

/** Les trois mois d'un trimestre, en pied de frise. */
export function quarterMonthLabels(quarter: number): string[] {
  return MONTHS_SHORT[quarter - 1] ?? []
}

/**
 * Ce que dit un trimestre sans matière — **jamais un reproche**.
 *
 * Un trimestre à venir est une page blanche, pas un manque : il annonce quand on
 * le remplira. Un trimestre passé sans objectif constate, et s'arrête là.
 */
export function emptyQuarterCopy(
  quarter: number,
  ahead: boolean,
): { title: string; hint: string } {
  if (ahead) {
    return {
      title: 'Trimestre pas encore commencé',
      hint: `Vous poserez vos objectifs au bilan du trimestre ${quarter - 1}.`,
    }
  }
  return {
    title: 'Aucun objectif porté sur ce trimestre',
    hint: 'Rien n’a été suivi sur cette période.',
  }
}
