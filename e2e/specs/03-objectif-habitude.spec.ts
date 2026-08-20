import { expect, test } from '../fixtures/auth'
import {
  addDays,
  appToday,
  createHabit,
  createTask,
  deleteAllObjectives,
} from '../helpers/data'
import { deplierTerminees, tacheCochee, tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// L'objectif « habitude » et sa mécanique de crédit — le fichier le plus dense en
// règles métier de toute la suite.
//
// Ce qui crédite une période d'habitude, c'est l'UNION des jours de tâches liées
// cochées et des jours de séance. Deux conséquences que ces tests verrouillent :
// le compteur compte des JOURS, pas des actions ; et une tâche et une séance le même
// jour ne valent qu'un seul jour.

// Les places sont limitées (3 principaux, 5 secondaires) et l'unicité porte sur le
// chevauchement de fenêtre : sans ce nettoyage, le troisième test du worker se
// heurterait à `slot_full`.
test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

/** L'anneau de cadence, seul endroit qui affiche le relevé de la période courante. */
function anneau(page: import('@playwright/test').Page, done: number, target: number) {
  const jours = done > 1 ? 'jours actifs' : 'jour actif'
  return page.getByRole('img', { name: `${done} ${jours} sur ${target} cette période` })
}

test('créer un objectif « rythme dans ma semaine » depuis l’assistant', async ({ page }) => {
  const suffixe = unique()
  const titre = `Courir 100 fois ${suffixe}`

  await page.goto('/objectifs')
  // Le chemin de création dépend de l'état de l'écran : « Créer mon premier objectif »
  // dans l'état vide, « Nouvel objectif » au bas du rail dès qu'il en existe un. Le
  // compte est vide en début de test (nettoyage en afterEach), mais viser les deux rend
  // le test indépendant de cet ordre.
  await page
    .getByRole('button', { name: /Créer mon premier objectif|Nouvel objectif/ })
    .click()

  // Le titre de la modale change à chaque étape : on ancre sur le dialogue lui-même,
  // pas sur son nom.
  const assistant = page.getByRole('dialog')
  await expect(assistant).toBeVisible()

  // 1. Nature. Les guillemets et apostrophes de l'app sont typographiques : ces
  //    libellés sont copiés du source, jamais retapés.
  await assistant.getByRole('radio', { name: 'Un objectif principal' }).click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // 2. Objectif et nom court.
  await assistant.getByLabel('Votre objectif').fill(titre)
  await assistant.getByLabel('Son nom court').fill(`C${suffixe.slice(0, 5)}`)
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // 3. Horizon : « toute l'année » est le défaut, l'étape est déjà prête.
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // 4. Façon de suivre.
  await assistant
    .getByRole('radio', { name: '« Je veux un rythme dans ma semaine »' })
    .click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // 5. Rythme : semaine et cadence 3 sont les défauts, le bouton final est déjà actif.
  await assistant.getByRole('button', { name: 'Créer l’objectif' }).click()

  await expect(assistant).toBeHidden()
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()
})

test('une tâche liée cochée crédite un jour, trois le même jour n’en créditent qu’un', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const objectifId = await createHabit(account.client, account.userId, {
    label: `H${suffixe.slice(0, 5)}`,
    title: `Courir ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })

  const titres = [1, 2, 3].map((n) => `Séance ${n} ${suffixe}`)
  for (const title of titres) {
    await createTask(account.client, account.userId, {
      title,
      dueDate: today,
      objectiveId: objectifId,
    })
  }

  await page.goto('/taches')
  await expect(anneau(page, 0, 3)).toBeVisible()

  await tacheOuverte(page, titres[0]).click()
  await expect(anneau(page, 1, 3)).toBeVisible()

  // Le compteur compte des JOURS distincts, pas des tâches : deux tâches de plus le
  // même jour ne doivent rien ajouter.
  await tacheOuverte(page, titres[1]).click()
  await tacheOuverte(page, titres[2]).click()
  await expect(anneau(page, 1, 3)).toBeVisible()

  await deleteAllObjectives(account.client, account.userId)
})

test('décocher la dernière tâche du jour retire le jour crédité', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const objectifId = await createHabit(account.client, account.userId, {
    label: `H${suffixe.slice(0, 5)}`,
    title: `Nager ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })
  const titre = `Longueurs ${suffixe}`
  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: today,
    objectiveId: objectifId,
  })

  await page.goto('/taches')
  await tacheOuverte(page, titre).click()
  await expect(anneau(page, 1, 3)).toBeVisible()

  await deplierTerminees(page)
  await tacheCochee(page, titre).click()

  // Le relevé est recalculé depuis zéro à chaque changement, jamais décrémenté :
  // c'est ce qui rend le décochage, le changement d'échéance et la suppression
  // équivalents pour le serveur.
  await expect(anneau(page, 0, 3)).toBeVisible()
})

test('une séance et une tâche le même jour ne comptent que pour un jour', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const objectifId = await createHabit(account.client, account.userId, {
    label: `H${suffixe.slice(0, 5)}`,
    title: `Ramer ${suffixe}`,
    year: Number(today.slice(0, 4)),
    cadence: 3,
  })
  const titre = `Sortie ${suffixe}`
  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: today,
    objectiveId: objectifId,
  })

  await page.goto('/taches')
  await tacheOuverte(page, titre).click()
  await expect(anneau(page, 1, 3)).toBeVisible()

  // Une séance le MÊME jour : l'union dédoublonne, le compteur ne bouge pas.
  const { error: memeJour } = await account.client
    .from('objective_session')
    .insert({ objective_id: objectifId, day: today })
  expect(memeJour).toBeNull()
  await page.reload()
  await expect(anneau(page, 1, 3)).toBeVisible()

  // Une séance un AUTRE jour de la même semaine : là, le compteur avance.
  // On recule d'un jour plutôt que d'avancer : une séance future est refusée
  // (`objective_session_future`).
  const { error: autreJour } = await account.client
    .from('objective_session')
    .insert({ objective_id: objectifId, day: addDays(today, -1) })
  expect(autreJour).toBeNull()
  await page.reload()
  await expect(anneau(page, 2, 3)).toBeVisible()
})
