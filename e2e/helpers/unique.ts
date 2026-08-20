/**
 * Suffixe court et unique pour les données créées par un test.
 *
 * C'est ce qui rend le partage d'un compte entre les tests d'un même worker sans
 * danger : deux tests peuvent créer « une tâche » sans que `getByText` devienne
 * ambigu. Sans lui, il faudrait un compte par test — et le quota d'authentification
 * de la stack locale l'interdit (voir fixtures/auth.ts).
 */
export function unique(): string {
  return crypto.randomUUID().slice(0, 8)
}
