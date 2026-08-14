// Règle reprise telle quelle de la maquette : 3 critères, score 0..3,
// et tout mot de passe non vide vaut au moins 1.
export function passwordScore(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0

  let n = 0
  if (password.length >= 8) n++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) n++
  if (/[0-9!-/:-@]/.test(password)) n++

  return Math.max(1, n) as 1 | 2 | 3
}

export const PASSWORD_SCORE_LABELS = ['', 'Faible', 'Moyen', 'Solide'] as const
