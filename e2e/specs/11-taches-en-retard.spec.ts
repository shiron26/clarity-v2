import { expect, test } from '../fixtures/auth'
import { addDays, appToday, createTask } from '../helpers/data'
import { tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// La section « EN RETARD » et ses deux actions en masse, branchées sur deux RPC
// (`postpone_overdue_tasks`, `undate_overdue_tasks`).
//
// Les deux boutons ont la même taille, et ce n'est pas un détail de maquette : retirer
// la date n'est pas un repli, c'est souvent la réponse honnête devant une pile de
// retards. Un test par sortie, donc.

test('« Tout reporter à aujourd’hui » vide la section des retards', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const titres = [`Rappeler le garage ${suffixe}`, `Envoyer le devis ${suffixe}`]

  await createTask(account.client, account.userId, {
    title: titres[0],
    dueDate: addDays(today, -3),
  })
  await createTask(account.client, account.userId, {
    title: titres[1],
    dueDate: addDays(today, -9),
  })

  await page.goto('/taches')
  await expect(page.getByRole('heading', { name: 'EN RETARD (2)' })).toBeVisible()

  await page.getByRole('button', { name: 'Tout reporter à aujourd’hui' }).click()

  // Reportées à aujourd'hui : plus de retard, et les deux tâches sont dans la vue du
  // jour. Le compte des retards est le signal le plus net.
  await expect(page.getByRole('heading', { name: /^EN RETARD/ })).toBeHidden()
  for (const titre of titres) {
    await expect(tacheOuverte(page, titre)).toBeVisible()
  }
})

test('« Tout mettre sans date » renvoie les retards dans le vivier', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const titre = `Trier le garage ${suffixe}`

  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: addDays(today, -5),
  })

  await page.goto('/taches')
  await expect(page.getByRole('heading', { name: 'EN RETARD (1)' })).toBeVisible()

  await page.getByRole('button', { name: 'Tout mettre sans date' }).click()
  await expect(page.getByRole('heading', { name: /^EN RETARD/ })).toBeHidden()

  // « Sans date » est le vivier : ce qu'on a capturé sans rien promettre. Une tâche
  // non datée crédite quand même le jour où on la coche.
  await page.goto('/taches?vue=sans-date')
  await expect(page.getByRole('heading', { name: 'Sans date' })).toBeVisible()
  await expect(tacheOuverte(page, titre)).toBeVisible()
})
