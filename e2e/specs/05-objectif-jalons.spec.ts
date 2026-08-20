import { expect, test } from '../fixtures/auth'
import { appToday, createMilestones, createObjective, deleteAllObjectives } from '../helpers/data'
import { unique } from '../helpers/unique'

// L'objectif « jalons » : le troisième type, et le seul qui n'a AUCUN rythme.
// `period_unit` y est nul, donc `refresh_objective_period` sort avant tout calcul et
// aucune ligne de période n'existe jamais. C'est une règle produit, pas un oubli :
// un objectif par étapes ne demande rien chaque semaine.

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

test('créer un objectif « je franchis des étapes » et cocher une étape', async ({ page }) => {
  const suffixe = unique()
  const titre = `Passer le permis bateau ${suffixe}`
  const etapes = [`Code ${suffixe}`, `Pratique ${suffixe}`, `Examen ${suffixe}`]

  await page.goto('/objectifs')
  await page
    .getByRole('button', { name: /Créer mon premier objectif|Nouvel objectif/ })
    .click()

  const assistant = page.getByRole('dialog')
  await assistant.getByRole('radio', { name: 'Un objectif principal' }).click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  await assistant.getByLabel('Votre objectif').fill(titre)
  await assistant.getByLabel('Son nom court').fill(`B${suffixe.slice(0, 5)}`)
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  await assistant.getByRole('button', { name: 'Continuer' }).click() // horizon : défaut

  await assistant.getByRole('radio', { name: '« Je franchis des étapes »' }).click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // Quatre lignes fixes, une seule suffit à activer le bouton.
  for (const [index, etape] of etapes.entries()) {
    await assistant.getByLabel(`Étape ${index + 1}`).fill(etape)
  }
  await assistant.getByRole('button', { name: 'Créer l’objectif' }).click()

  await expect(assistant).toBeHidden()
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // Cocher une étape fait avancer le compteur. Guillemets français dans le libellé.
  await page.getByRole('button', { name: `Cocher « ${etapes[0]} »`, exact: true }).click()
  await expect(
    page.getByRole('button', { name: `Décocher « ${etapes[0]} »`, exact: true }),
  ).toBeVisible()
  // Une étape sur trois. La progression d'un objectif à jalons, c'est le compte des
  // étapes franchies : rien d'autre ne la fait bouger.
  await expect(page.getByText('33 %')).toBeVisible()
})

test('un objectif à jalons n’affiche aucun rythme ni relevé', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const titre = `Refaire le bureau ${suffixe}`

  const objectifId = await createObjective(account.client, account.userId, {
    label: `B${suffixe.slice(0, 5)}`,
    title: titre,
    measure: 'jalons',
    year: Number(today.slice(0, 4)),
  })
  await createMilestones(account.client, objectifId, Number(today.slice(0, 4)), quarterOf(today), [
    `Choisir la peinture ${suffixe}`,
  ])

  await page.goto('/objectifs')
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // Ni cadence, ni relevé, ni régularité : c'est ce que dit `detailLayout.rhythm = null`.
  // Un objectif par étapes n'a pas de rythme à tenir, donc aucune bande sombre.
  await expect(page.getByRole('heading', { name: /^Régularité/ })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Vos relevés' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Saisir mon relevé' })).toBeHidden()
})

test('le plafond de quatre jalons par trimestre se voit à l’écran', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const annee = Number(today.slice(0, 4))
  const titre = `Lancer le side project ${suffixe}`

  const objectifId = await createObjective(account.client, account.userId, {
    label: `S${suffixe.slice(0, 5)}`,
    title: titre,
    measure: 'jalons',
    year: annee,
  })
  await createMilestones(
    account.client,
    objectifId,
    annee,
    quarterOf(today),
    [1, 2, 3, 4].map((n) => `Étape ${n} ${suffixe}`),
  )

  await page.goto('/objectifs')

  // À quatre jalons, le bouton d'ajout cède la place à un texte inerte : la limite se
  // dit avant d'être atteinte, plutôt que de renvoyer l'erreur serveur `milestone_cap`.
  await expect(page.getByRole('button', { name: '+ Ajouter un jalon' })).toBeHidden()
  await expect(page.getByText('Quatre jalons maximum par trimestre')).toBeVisible()
})

/** Le trimestre d'une date `YYYY-MM-DD`, 1 à 4. */
function quarterOf(iso: string): number {
  return Math.floor(Number(iso.slice(5, 7)) / 3.001) + 1
}
