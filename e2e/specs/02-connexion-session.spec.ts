import { expect, test } from '@playwright/test'
import { createTestAccount, type TestAccount } from '../fixtures/account'

// Le vrai parcours de connexion, par l'interface — donc SANS la fixture qui injecte
// une session (LoginPage redirige aussitôt vers « / » quand on est déjà connecté).
//
// Ce que ce fichier protège : `src/lib/authStorage.ts`, la pièce la plus sur-mesure du
// front. Il aiguille la session entre `localStorage` et `sessionStorage` selon la case
// « Rester connecté », et purge le store inactif. Une erreur là déconnecte tout le
// monde au premier rechargement, et aucun typecheck ne la verrait.

let account: TestAccount

// Un seul compte pour les trois tests : le quota d'authentification de la stack locale
// est de 30 inscriptions/connexions par 5 minutes, et chaque test consomme déjà une
// connexion.
test.beforeAll(async () => {
  account = await createTestAccount({ onboarded: true })
})

test('se connecter, et rester connecté après un rechargement', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse email').fill(account.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password)

  // Cochée par défaut : c'est ce qui envoie la session dans localStorage.
  await expect(page.getByRole('checkbox', { name: 'Rester connecté' })).toBeChecked()
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  // L'assertion qui compte vraiment : la session survit au rechargement.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
})

test('se déconnecter ferme l’accès aux écrans protégés', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse email').fill(account.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('heading', { name: 'Content de vous revoir' })).toBeVisible()

  // ProtectedRoute renvoie vers /login toute navigation directe une fois déconnecté.
  await page.goto('/taches')
  await expect(page).toHaveURL(/\/login/)
})

test('un mot de passe faux affiche une erreur, pas un écran blanc', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Adresse email').fill(account.email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-invalide')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // Aucun message serveur brut à l'écran : la copie passe par authErrorMessage().
  const alerte = page.getByRole('alert')
  await expect(alerte).toBeVisible()
  await expect(alerte).not.toContainText('Invalid login credentials')
  await expect(page).toHaveURL(/\/login/)
})
