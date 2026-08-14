// L'échelle de notation d'une review : trois fusées, ni plus ni moins.
//
// La contrainte vient de la base (`review_item.rating check between 1 and 3`) et
// la métaphore de la fusée est l'identité de la marque (SPEC §1 : l'app ne
// calcule aucun score, l'utilisateur pose lui-même son jugement).
//
// Partagé parce que trois écrans le lisent : la sparkline « ÉVOLUTION Qn » de
// l'écran Objectifs, la grille des semaines du hub de review, et les gros
// boutons du flow de notation.

export type Rating = 1 | 2 | 3

/** 1 = au sol (gris), 2 = en vol (ambre), 3 = en orbite (bleu d'action). */
export const RATING_COLORS: Record<number, string> = {
  1: '#9aa0b5',
  2: '#f5a524',
  3: '#1a66ff',
}

export const RATINGS: Rating[] = [1, 2, 3]

export type RatingLabel = { label: string; hint: string }

export const RATING_LABELS: Record<Rating, RatingLabel> = {
  1: { label: 'Au sol', hint: 'rien fait cette semaine' },
  2: { label: 'En vol', hint: 'j’ai avancé' },
  3: { label: 'En orbite', hint: 'semaine excellente' },
}

/**
 * Inclinaison de la fusée selon la note : posée, en montée, plein cap. Le
 * mouvement porte le sens autant que la couleur — la maquette s'appuie dessus
 * pour rendre l'échelle lisible sans lire les libellés.
 */
export const RATING_TILT: Record<Rating, string> = {
  1: 'none',
  2: 'rotate(-20deg)',
  3: 'rotate(-45deg)',
}

/** Longueur maximale d'un commentaire — règle serveur `review_item_comment_too_long`. */
export const MAX_COMMENT = 280
