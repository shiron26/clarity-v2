import { expect, test } from '../fixtures/auth'
import { addDays, appToday, createTask } from '../helpers/data'
import { deplierTerminees, tacheCochee, tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// Le chemin d'écriture le plus fréquent du produit, et le plus riche en régressions
// déjà vécues (voir AGENTS.md).
//
// Deux règles de ciblage valent pour tout ce fichier, toutes deux apprises en le
// faisant échouer :
//
// 1. On cible par RÔLE, jamais par texte brut. L'écran Tâches monte sa version desktop
//    et sa version mobile en même temps, donc `getByText(titre)` résout à deux éléments
//    et le mode strict refuse — à raison, c'est une vraie ambiguïté.
// 2. Toujours `exact: true` sur un nom accessible (d'où `helpers/locators.ts`) :
//    « Cocher X » est une sous-chaîne de « Décocher X ».

test('créer une tâche depuis la modale, puis la retrouver dans la liste', async ({ page }) => {
  const titre = `Relire le plan ${unique()}`

  // `?nouvelle=1` ouvre la modale depuis n'importe quelle route (src/hooks/useNewTask.ts).
  // Plus robuste que de chercher le bouton déclencheur, qui diffère entre desktop et mobile.
  await page.goto('/taches?nouvelle=1')

  const modale = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await expect(modale).toBeVisible()

  await modale.getByLabel('Titre de la tâche').fill(titre)
  // « Ajouter ↵ » en desktop, « Ajouter la tâche » en mobile : une regex couvre les deux.
  await modale.getByRole('button', { name: /^Ajouter/ }).click()

  await expect(modale).toBeHidden()
  await expect(tacheOuverte(page, titre)).toBeVisible()
})

test('cocher une tâche la déplace dans « Terminées », décocher la ramène', async ({
  page,
  account,
}) => {
  const titre = `Arroser les plantes ${unique()}`
  const today = await appToday(account.client)
  await createTask(account.client, account.userId, { title: titre, dueDate: today })

  await page.goto('/taches')

  // Aucune attente manuelle malgré la séquence animée en deux phases
  // (DONE_FLASH_MS 680 ms puis DONE_CLEAR_MS 1000 ms) : l'assertion réessaie.
  await tacheOuverte(page, titre).click()
  await deplierTerminees(page)
  await expect(tacheCochee(page, titre)).toBeVisible()

  await tacheCochee(page, titre).click()
  await expect(tacheOuverte(page, titre)).toBeVisible()
})

test('une occurrence récurrente n’en engendre qu’une, et le décochage la reprend', async ({
  page,
  account,
}) => {
  const titre = `Sortir les poubelles ${unique()}`
  const today = await appToday(account.client)
  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: today,
    recurrence: { type: 'daily', interval: 1 },
  })

  // « Toutes » : l'occurrence engendrée est datée de demain et n'apparaîtrait pas dans
  // la vue du jour.
  await page.goto('/taches?vue=toutes')
  const ouvertes = tacheOuverte(page, titre)
  const cochees = tacheCochee(page, titre)

  await expect(ouvertes).toHaveCount(1)
  await ouvertes.click()

  await deplierTerminees(page)
  // UNE occurrence cochée, et UNE seule occurrence suivante. C'est la régression
  // documentée : « décocher puis recocher laissait deux tâches futures, et N cycles en
  // laissaient N ».
  await expect(cochees).toHaveCount(1)
  await expect(ouvertes).toHaveCount(1)

  // Décocher défait la génération : l'occurrence engendrée est supprimée tant qu'elle
  // est encore décochée (colonne privée `generated_from`).
  await cochees.click()
  await expect(cochees).toHaveCount(0)
  await expect(ouvertes).toHaveCount(1)

  // Un second cycle ne doit rien accumuler : toujours une cochée et une ouverte.
  await ouvertes.click()
  await deplierTerminees(page)
  await expect(cochees).toHaveCount(1)
  await expect(ouvertes).toHaveCount(1)
})

test('une occurrence récurrente ne se coche pas avant son échéance', async ({
  page,
  account,
}) => {
  const titre = `Payer le loyer ${unique()}`
  const today = await appToday(account.client)
  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: addDays(today, 3),
    recurrence: { type: 'monthly', interval: 1 },
  })

  await page.goto('/taches?vue=toutes')

  // La garde est posée AVANT le clic : la case est désactivée et porte la raison en
  // infobulle, plutôt que de laisser partir une écriture que le serveur refuserait.
  // Sans cette règle, la suivante retomberait sur la date qu'on vient de cocher et
  // chaque clic fabriquerait un doublon.
  const laCase = tacheOuverte(page, titre)
  await expect(laCase).toBeDisabled()
  await expect(laCase).toHaveAttribute(
    'title',
    'Cette tâche se répète : elle ne se coche pas avant son échéance.',
  )
})

test('supprimer une occurrence récurrente laisse le choix entre la fois et la série', async ({
  page,
  account,
}) => {
  const titre = `Changer le filtre ${unique()}`
  const today = await appToday(account.client)
  await createTask(account.client, account.userId, {
    title: titre,
    dueDate: today,
    recurrence: { type: 'weekly', interval: 1 },
  })

  await page.goto('/taches?vue=toutes')
  await page.getByRole('button', { name: `Supprimer ${titre}`, exact: true }).click()

  const dialogue = page.getByRole('dialog', { name: 'Supprimer' })
  await expect(dialogue).toBeVisible()

  // Deux boutons, pas une sélection à confirmer : le choix EST l'action.
  await dialogue.getByRole('button', { name: 'Seulement cette fois' }).click()
  await expect(dialogue).toBeHidden()

  // « Passer son tour » déplace l'échéance au prochain jour dû, calculé par le serveur
  // (private.next_due, jamais réimplémenté côté client) : la tâche existe toujours.
  await expect(tacheOuverte(page, titre)).toHaveCount(1)
})
