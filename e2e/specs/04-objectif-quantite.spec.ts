import { expect, test } from '../fixtures/auth'
import { appToday, createObjective, createTask, deleteAllObjectives } from '../helpers/data'
import { tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// L'objectif quantifié, et surtout le cas « à la baisse » : un point de départ
// AU-DESSUS de la cible. C'est la régression nommée dans AGENTS.md — la formule naïve
// `valeur / cible` suppose une montée depuis zéro, et elle annonçait « cible atteinte »
// sur un objectif de perte de poids le jour même de sa création.

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

test('un objectif à la baisse démarre à 0 %, pas à 100 %', async ({ page }) => {
  const suffixe = unique()
  const titre = `Descendre à 70 kg ${suffixe}`

  await page.goto('/objectifs')
  await page
    .getByRole('button', { name: /Créer mon premier objectif|Nouvel objectif/ })
    .click()

  const assistant = page.getByRole('dialog')
  await assistant.getByRole('radio', { name: 'Un objectif principal' }).click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  await assistant.getByLabel('Votre objectif').fill(titre)
  await assistant.getByLabel('Son nom court').fill(`P${suffixe.slice(0, 5)}`)
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  await assistant.getByRole('button', { name: 'Continuer' }).click() // horizon : défaut

  await assistant.getByRole('radio', { name: '« Je vise un chiffre »' }).click()
  await assistant.getByRole('button', { name: 'Continuer' }).click()

  // Le mode « Je note un total » (relevé) est le défaut : c'est lui qui demande un
  // point de départ, et donc lui qui permet un objectif descendant.
  await assistant.getByLabel('Valeur d’aujourd’hui').fill('78')
  await assistant.getByLabel('Valeur à atteindre').fill('70')
  await assistant.getByRole('button', { name: 'Créer l’objectif' }).click()

  await expect(assistant).toBeHidden()
  await expect(page.getByRole('heading', { name: titre })).toBeVisible()

  // Le cœur du test. `direction` n'est jamais demandée à l'utilisateur : elle se déduit
  // du fait que le départ est au-dessus de la cible. Et le pourcentage se calcule sur
  // le CHEMIN parcouru (78 → 70), pas sur `valeur / cible` qui donnerait 111 %, borné
  // à 100 %, soit « objectif atteint » le jour de la création.
  await expect(page.getByText('0 %')).toBeVisible()
  await expect(page.getByText('100 %')).toBeHidden()
})

test('saisir un relevé fait avancer la progression', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const titre = `Perdre du poids ${suffixe}`

  await createObjective(account.client, account.userId, {
    label: `P${suffixe.slice(0, 5)}`,
    title: titre,
    measure: 'quantite',
    year: Number(today.slice(0, 4)),
    periodUnit: 'week',
    entryMode: 'releve',
    startValue: 78,
    targetValue: 70,
    direction: 'sous',
    unit: 'kg',
  })

  await page.goto('/objectifs')
  await page.getByRole('button', { name: 'Saisir mon relevé' }).click()

  const modale = page.getByRole('dialog', { name: 'Saisir votre relevé' })
  await expect(modale).toBeVisible()
  await modale.getByLabel('Nouvelle valeur').fill('74')
  await modale.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(modale).toBeHidden()
  // 78 → 74 sur un chemin de 8 : la moitié.
  await expect(page.getByText('50 %')).toBeVisible()
})

test('une tâche liée à un objectif quantifié ne déplace pas sa progression', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const titre = `Lire 24 livres ${suffixe}`

  const objectifId = await createObjective(account.client, account.userId, {
    label: `L${suffixe.slice(0, 5)}`,
    title: titre,
    measure: 'quantite',
    year: Number(today.slice(0, 4)),
    periodUnit: 'week',
    entryMode: 'cumul',
    startValue: 0,
    targetValue: 24,
    direction: 'atteindre',
    unit: 'fois',
  })

  const tache = `Lire un chapitre ${suffixe}`
  await createTask(account.client, account.userId, {
    title: tache,
    dueDate: today,
    objectiveId: objectifId,
  })

  await page.goto('/objectifs')
  await expect(page.getByText('0 %')).toBeVisible()

  await page.goto('/taches')
  await tacheOuverte(page, tache).click()
  // On attend que la complétion soit acquittée avant de juger de l'effet.
  await expect(tacheOuverte(page, tache)).toHaveCount(0)

  // Une quantité se crédite par des RELEVÉS, jamais par des tâches : cocher n'a
  // aucun effet sur sa progression. C'est la distinction entre les trois mesures,
  // et elle est portée par `private.refresh_objective_period`.
  await page.goto('/objectifs')
  await expect(page.getByText('0 %')).toBeVisible()
})
