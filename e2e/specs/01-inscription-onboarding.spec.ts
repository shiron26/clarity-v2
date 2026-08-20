import { expect, test } from '@playwright/test'
import { unique } from '../helpers/unique'

// La porte d'entrée du produit, de bout en bout et sans raccourci : inscription réelle,
// puis les quatre questions de l'onboarding, puis le dashboard. Aucune fixture — c'est
// justement ce chemin qu'on veut voir fonctionner sans aide.
//
// Il traverse en un seul test : `signUp`, le trigger de création de profil,
// `useCreateObjectiveFully` (avec attribution du `slot` côté serveur) et
// `useCompleteOnboarding`. C'est le test le plus long de la suite, et le plus rentable :
// s'il casse, plus aucun nouvel utilisateur ne peut entrer.
//
// Il est piloté GÉNÉRIQUEMENT — remplir, cliquer le bouton primaire, attendre le titre
// suivant — plutôt qu'en codant six libellés en dur. Les titres viennent de
// `src/components/objectives/draft/copy.ts`, partagé avec l'assistant de l'écran
// Objectifs : y changer un mot ne doit pas casser ce test si le parcours, lui, marche.
const BOUTON_PRIMAIRE = /Continuer|Créer cet objectif|Entrer dans Clarity/

test('s’inscrire, traverser l’onboarding et arriver sur le dashboard', async ({ page }) => {
  const suffixe = unique()
  const email = `e2e+${suffixe}@clarity.test`

  await page.goto('/signup')
  await page.getByLabel('Nom').fill('Camille Durand')
  await page.getByLabel('Adresse email').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('e2e-Passw0rd!')
  await page.getByLabel('Confirmer le mot de passe').fill('e2e-Passw0rd!')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  // En local, `enable_confirmations = false` : la session arrive tout de suite et
  // l'overlay d'onboarding s'ouvre par-dessus le dashboard.
  const onboarding = page.getByRole('dialog', { name: 'Premiers pas sur Clarity' })
  await expect(onboarding).toBeVisible()

  // 1. L'objectif.
  await expect(
    onboarding.getByRole('heading', { name: 'Qu’est-ce que vous voulez accomplir ?' }),
  ).toBeVisible()
  await onboarding.getByLabel('Votre objectif').fill(`Courir 100 fois ${suffixe}`)
  await onboarding.getByLabel('Son nom court').fill(`C${suffixe.slice(0, 5)}`)
  await onboarding.getByRole('button', { name: BOUTON_PRIMAIRE }).click()

  // 2. L'horizon : « toute l'année » est le défaut, l'étape est déjà prête.
  await expect(
    onboarding.getByRole('heading', { name: 'Sur combien de temps ?' }),
  ).toBeVisible()
  await onboarding.getByRole('button', { name: BOUTON_PRIMAIRE }).click()

  // 3. La façon de suivre. C'est elle qui décide de l'écran suivant.
  await expect(
    onboarding.getByRole('heading', { name: 'Comment comptez-vous avancer dessus ?' }),
  ).toBeVisible()
  await onboarding
    .getByRole('radio', { name: '« Je veux un rythme dans ma semaine »' })
    .click()
  await onboarding.getByRole('button', { name: BOUTON_PRIMAIRE }).click()

  // 4. Le rythme : semaine et cadence 3 sont les défauts, l'objectif peut être créé.
  await expect(onboarding.getByRole('heading', { name: 'À quel rythme ?' })).toBeVisible()
  await onboarding.getByRole('button', { name: BOUTON_PRIMAIRE }).click()

  // 5. Les places, puis l'écran d'arrivée. Le libellé porte le compte d'objectifs pris.
  await onboarding.getByRole('button', { name: /^Continuer avec / }).click()
  await onboarding.getByRole('button', { name: 'Entrer dans Clarity' }).click()

  // L'overlay disparaît une fois `onboarded_at` posé, et il ne revient pas.
  await expect(onboarding).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()
  await expect(onboarding).toBeHidden()
})
