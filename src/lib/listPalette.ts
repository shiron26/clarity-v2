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

export const LIST_PALETTE = [
  '#8f9bde',
  '#1a66ff',
  '#00a3d9',
  '#5c5cff',
  '#00b862',
  '#e8590c',
  '#f5a524',
  '#d6431f',
] as const

/** Libellés lus par les lecteurs d'écran : une pastille n'a pas de texte. */
const LIST_COLOR_NAMES: Record<string, string> = {
  '#8f9bde': 'lavande',
  '#1a66ff': 'bleu',
  '#00a3d9': 'cyan',
  '#5c5cff': 'indigo',
  '#00b862': 'vert',
  '#e8590c': 'orange',
  '#f5a524': 'ambre',
  '#d6431f': 'rouge',
}

export function listColorName(color: string): string {
  return LIST_COLOR_NAMES[color] ?? 'couleur personnalisée'
}

/** Couleur proposée pour la prochaine liste créée : on avance dans la palette. */
export function nextListColor(existingCount: number): string {
  return LIST_PALETTE[existingCount % LIST_PALETTE.length]!
}
