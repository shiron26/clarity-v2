import { expect, test } from '../fixtures/auth'
import { unique } from '../helpers/unique'

// En mobile, l'app ne change pas seulement de CSS : elle rend un AUTRE arbre de
// composants. Barre d'onglets et bouton flottant au lieu de la colonne latérale,
// feuille de création avec son propre pied, feuille de filtres qui n'existe pas en
// desktop. Une suite desktop en couvre zéro pour cent, d'où ces tests marqués
// `@mobile` — le seul projet qui les exécute, sur un viewport de 393 px.

test('@mobile créer une tâche depuis le bouton flottant', async ({ page }) => {
  const titre = `Course du matin ${unique()}`

  await page.goto('/')
  // Le bouton central de la barre d'onglets : une action, pas une navigation. Il
  // remplace « Rituel », qui n'a que quatre places à côté de lui.
  await page.getByRole('button', { name: 'Nouvelle tâche' }).click()

  const feuille = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await expect(feuille).toBeVisible()
  await feuille.getByLabel('Titre de la tâche').fill(titre)

  // Le pied de la feuille mobile porte « Ajouter la tâche » là où le desktop écrit
  // « Ajouter ↵ » : ce sont deux colonnes distinctes du même composant.
  await feuille.getByRole('button', { name: 'Ajouter la tâche' }).click()
  await expect(feuille).toBeHidden()

  await expect(
    page.getByRole('checkbox', { name: `Cocher ${titre}`, exact: true }),
  ).toBeVisible()
})

test('@mobile naviguer par la barre d’onglets et ouvrir la feuille de filtres', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Tâches' }).click()
  await expect(page).toHaveURL(/\/taches/)
  // Apostrophe typographique : « Aujourd’hui », U+2019. Retapée droite, elle ne
  // matcherait jamais.
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible()

  // La feuille de filtres n'existe qu'en mobile : en desktop, les mêmes réglages sont
  // posés à plat dans la barre d'outils.
  await page.getByRole('button', { name: 'Filtrer et trier' }).click()
  await expect(page.getByRole('dialog', { name: 'Afficher' })).toBeVisible()
})
