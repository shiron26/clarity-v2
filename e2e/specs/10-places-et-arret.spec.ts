import { expect, test } from '../fixtures/auth'
import {
  appToday,
  createMilestones,
  createObjective,
  deleteAllObjectives,
  trimestreDe,
} from '../helpers/data'
import { unique } from '../helpers/unique'

// Deux règles de cycle de vie qu'aucun autre test ne touche :
//
// 1. Les places sont limitées, et l'interface le DIT avant de laisser essayer plutôt
//    que de renvoyer l'erreur serveur `slot_full`. C'est cette garde qu'on vérifie —
//    l'erreur elle-même n'est pas atteignable au clic, et sa copie relève d'un test
//    unitaire sur `dataErrorMessage()`.
// 2. Arrêter un objectif le gèle : son passé ne se modifie plus, mais il garde sa
//    place jusqu'à la fin de sa fenêtre. « Arrêter » n'est pas « atteint ».

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

test('les trois places prises, l’assistant refuse un quatrième principal', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const annee = Number(today.slice(0, 4))

  // Trois principaux : le maximum. `jalons` est la mesure la moins exigeante à créer,
  // et la nature seule compte ici.
  for (const n of [1, 2, 3]) {
    await createObjective(account.client, account.userId, {
      label: `P${n}${suffixe.slice(0, 4)}`,
      title: `Objectif ${n} ${suffixe}`,
      measure: 'jalons',
      year: annee,
    })
  }

  await page.goto('/objectifs')
  await page.getByRole('button', { name: 'Nouvel objectif' }).click()

  const assistant = page.getByRole('dialog')
  const principal = assistant.getByRole('radio', { name: /Un objectif principal/ })

  // La carte reste AFFICHÉE, avec son compte : c'est la seule façon de faire
  // comprendre qu'une place se libère à la fin de la fenêtre d'un objectif, et pas
  // au 31 décembre.
  await expect(principal).toBeVisible()
  await expect(principal).toBeDisabled()
  await expect(principal).toContainText('Les 3 places sont prises.')

  // Les cinq places secondaires, elles, sont intactes.
  await expect(assistant.getByRole('radio', { name: /Un objectif secondaire/ })).toBeEnabled()
})

test('arrêter un objectif le gèle, le reprendre le rouvre', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const annee = Number(today.slice(0, 4))
  const titre = `Permis bateau ${suffixe}`
  const etape = `Réviser le code ${suffixe}`

  const objectifId = await createObjective(account.client, account.userId, {
    label: `B${suffixe.slice(0, 5)}`,
    title: titre,
    measure: 'jalons',
    year: annee,
  })
  await createMilestones(account.client, objectifId, annee, trimestreDe(today), [etape])

  await page.goto('/objectifs')
  const jalon = page.getByRole('button', { name: `Cocher « ${etape} »`, exact: true })
  await expect(jalon).toBeEnabled()

  await page.getByRole('button', { name: 'Actions de l’objectif' }).click()
  await page.getByRole('menuitem', { name: 'Arrêter cet objectif' }).click()

  // L'objectif reste là, marqué de sa date d'arrêt, et son passé n'est plus
  // modifiable. On assert sur la ligne de méta et non sur le badge « Arrêté » :
  // celui-ci apparaît DEUX fois, dans le rail et dans l'en-tête, et le mode strict
  // refuserait de trancher.
  await expect(page.getByText(/arrêté le /)).toBeVisible()
  await expect(jalon).toBeDisabled()

  // Reprendre le rouvre : l'arrêt n'est pas une suppression. C'est même ce que dit la
  // confirmation de suppression — « pour garder la trace, préférez Arrêter ».
  await page.getByRole('button', { name: 'Actions de l’objectif' }).click()
  await page.getByRole('menuitem', { name: 'Reprendre' }).click()

  await expect(page.getByText(/arrêté le /)).toBeHidden()
  await expect(jalon).toBeEnabled()
})
