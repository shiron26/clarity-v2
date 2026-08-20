// Palette fixe des listes (DESIGN.md : « ne pas sortir de la palette fixe à 8
// couleurs pour les objectifs/listes »). Les objectifs ont la leur, dérivée du
// slot — celle-ci est choisie par l'utilisateur, liste par liste.

/**
 * La pastille d'une liste sans couleur choisie — la valeur de `--color-ink-muted`.
 *
 * En dur plutôt qu'en classe Tailwind : la couleur d'une liste est dynamique,
 * donc posée en style inline, et un `??` dans du JSX ne peut pas retomber sur une
 * classe. Cinq pastilles écrivaient le littéral, sans lien visible avec le token.
 */
export const DEFAULT_LIST_COLOR = '#9a9aa6'

/**
 * Huit couleurs FRANCHES, et une seule par famille de teinte.
 *
 * La palette d'origine partait d'un lavande délavé et empilait trois bleus
 * (bleu, cyan, indigo) : à la taille d'une pastille de 20 px, un ton pastel ne
 * se distingue plus du gris d'une liste sans couleur, et deux voisines de même
 * famille ne se distinguent plus l'une de l'autre. Le violet et le rose ouvrent
 * le cercle du côté qui manquait.
 *
 * Le rouge n'est plus `#d6431f` : c'était exactement la couleur `danger`, et une
 * liste teintée comme le bouton de suppression n'aide personne.
 */
export const LIST_PALETTE = [
  '#7c3aed',
  '#1a66ff',
  '#00b8e6',
  '#e5197f',
  '#00c25f',
  '#f97316',
  '#fbbf24',
  '#e5252b',
] as const

/** Libellés lus par les lecteurs d'écran : une pastille n'a pas de texte. */
const LIST_COLOR_NAMES: Record<string, string> = {
  '#7c3aed': 'violet',
  '#1a66ff': 'bleu',
  '#00b8e6': 'cyan',
  '#e5197f': 'rose',
  '#00c25f': 'vert',
  '#f97316': 'orange',
  '#fbbf24': 'ambre',
  '#e5252b': 'rouge',
}

export function listColorName(color: string): string {
  return LIST_COLOR_NAMES[color] ?? 'couleur personnalisée'
}

/** Couleur proposée pour la prochaine liste créée : on avance dans la palette. */
export function nextListColor(existingCount: number): string {
  return LIST_PALETTE[existingCount % LIST_PALETTE.length]!
}
