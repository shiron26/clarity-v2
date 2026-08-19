import { expect, test } from '../fixtures/auth'
import {
  appToday,
  createHabit,
  createObjective,
  createTask,
  deleteAllObjectives,
} from '../helpers/data'
import { tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// Le lien tâche → objectif : ce qui fait que cocher une tâche fait avancer autre chose
// qu'elle-même. Le choix se fait dans un `radiogroup` nommé « Objectif rattaché », et
// seuls les objectifs PRINCIPAUX personnels y sont proposés — le serveur refuse le
// reste (`task_objective_invalid_target`).

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

function anneau(page: import('@playwright/test').Page, done: number, target: number) {
  const jours = done > 1 ? 'jours actifs' : 'jour actif'
  return page.getByRole('img', { name: `${done} ${jours} sur ${target} cette période` })
}

test('rattacher une tâche à un objectif depuis la modale de création', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const court = `H${suffixe.slice(0, 5)}`
  await createHabit(account.client, account.userId, {
    label: court,
    title: `Courir ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })

  const tache = `Footing ${suffixe}`
  await page.goto('/taches?nouvelle=1')
  const modale = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await modale.getByLabel('Titre de la tâche').fill(tache)

  const objectifs = modale.getByRole('radiogroup', { name: 'Objectif rattaché' })
  await objectifs.getByRole('radio', { name: court, exact: true }).click()
  await modale.getByRole('button', { name: /^Ajouter/ }).click()
  await expect(modale).toBeHidden()

  // La preuve du rattachement n'est pas une pastille de couleur (invisible aux tests) :
  // c'est que cocher la tâche crédite un jour à l'objectif.
  await expect(anneau(page, 0, 3)).toBeVisible()
  await tacheOuverte(page, tache).click()
  await expect(anneau(page, 1, 3)).toBeVisible()
})

test('seuls les objectifs principaux sont proposés au rattachement', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const annee = Number(today.slice(0, 4))

  const principal = `P${suffixe.slice(0, 5)}`
  const secondaire = `S${suffixe.slice(0, 5)}`
  await createHabit(account.client, account.userId, {
    label: principal,
    title: `Courir ${suffixe}`,
    year: annee,
  })
  await createObjective(account.client, account.userId, {
    label: secondaire,
    title: `Refaire le bureau ${suffixe}`,
    measure: 'jalons',
    kind: 'secondaire',
    year: annee,
  })

  await page.goto('/taches?nouvelle=1')
  const objectifs = page
    .getByRole('dialog', { name: 'Nouvelle tâche' })
    .getByRole('radiogroup', { name: 'Objectif rattaché' })

  await expect(objectifs.getByRole('radio', { name: principal, exact: true })).toBeVisible()
  // Un secondaire ne demande rien chaque semaine : lui rattacher une tâche n'aurait
  // aucun sens, et le serveur le refuserait de toute façon.
  await expect(objectifs.getByRole('radio', { name: secondaire, exact: true })).toHaveCount(0)
  await expect(objectifs.getByRole('radio', { name: 'Aucun' })).toBeVisible()
})

test('détacher une tâche l’empêche de créditer l’objectif', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const court = `H${suffixe.slice(0, 5)}`
  const objectifId = await createHabit(account.client, account.userId, {
    label: court,
    title: `Méditer ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })

  const tache = `Dix minutes ${suffixe}`
  await createTask(account.client, account.userId, {
    title: tache,
    dueDate: today,
    objectiveId: objectifId,
  })

  // On détache une tâche OUVERTE : c'est le seul chemin qu'offre le produit. Une tâche
  // cochée rejoint « Terminées », où la ligne est un texte barré et non un bouton —
  // elle ne se rouvre pas.
  await page.goto('/taches')
  await page.getByRole('button', { name: `Ouvrir ${tache}`, exact: true }).click()

  const edition = page.getByRole('dialog')
  const objectifs = edition.getByRole('radiogroup', { name: 'Objectif rattaché' })
  await expect(objectifs.getByRole('radio', { name: court, exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // Le choix s'écrit immédiatement, sans bouton de validation.
  await objectifs.getByRole('radio', { name: 'Aucun' }).click()
  await edition.getByRole('button', { name: 'Fermer' }).click()
  await expect(edition).toBeHidden()

  // Détachée, la tâche ne crédite plus rien : l'anneau reste à zéro même cochée.
  await tacheOuverte(page, tache).click()
  await expect(anneau(page, 0, 3)).toBeVisible()
})

test('l’occurrence suivante d’une tâche récurrente hérite de l’objectif', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const court = `H${suffixe.slice(0, 5)}`
  const objectifId = await createHabit(account.client, account.userId, {
    label: court,
    title: `Pompes ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })

  const tache = `Série du jour ${suffixe}`
  await createTask(account.client, account.userId, {
    title: tache,
    dueDate: today,
    objectiveId: objectifId,
    recurrence: { type: 'daily', interval: 1 },
  })

  await page.goto('/taches?vue=toutes')
  await tacheOuverte(page, tache).click()

  // L'occurrence engendrée porte le même titre : on ouvre la seule encore ouverte.
  await expect(tacheOuverte(page, tache)).toHaveCount(1)
  await page.getByRole('button', { name: `Ouvrir ${tache}`, exact: true }).first().click()

  const edition = page.getByRole('dialog')
  await expect(
    edition
      .getByRole('radiogroup', { name: 'Objectif rattaché' })
      .getByRole('radio', { name: court, exact: true }),
  ).toHaveAttribute('aria-checked', 'true')
})
