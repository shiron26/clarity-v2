import { expect, test } from '../fixtures/auth'
import { appToday, createTask } from '../helpers/data'
import { tacheOuverte } from '../helpers/locators'
import { unique } from '../helpers/unique'

// Les listes : créer, ranger une tâche dedans, puis filtrer.
//
// Le filtre par liste RESTREINT la vue, il ne la remplace pas : `?vue=` et `?liste=`
// se combinent. C'est ce que ce fichier vérifie de bout en bout, en passant par
// l'interface pour la création et par l'URL pour le filtre.

test('créer une liste, y ranger une tâche, puis filtrer dessus', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const nomListe = `Atelier ${suffixe}`
  const dedans = `Poncer l’étagère ${suffixe}`
  const dehors = `Appeler le notaire ${suffixe}`

  // Une tâche hors liste, pour que le filtre ait quelque chose à écarter.
  await createTask(account.client, account.userId, { title: dehors, dueDate: today })

  // `?listes=1` ouvre « Gérer les listes » sans quitter la vue courante.
  await page.goto('/taches?listes=1')
  const gestion = page.getByRole('dialog', { name: 'Gérer les listes' })
  await expect(gestion).toBeVisible()

  await gestion.getByLabel('Nom de la nouvelle liste').fill(nomListe)
  await gestion.getByRole('button', { name: 'Ajouter' }).click()

  // La liste créée devient éditable en place : son champ de nom porte son nom.
  await expect(gestion.getByLabel(`Nom de la liste ${nomListe}`)).toBeVisible()
  await gestion.getByRole('button', { name: 'Fermer' }).click()
  await expect(gestion).toBeHidden()

  // Ranger une tâche dans cette liste, depuis la modale de création.
  await page.goto('/taches?nouvelle=1')
  const modale = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await modale.getByLabel('Titre de la tâche').fill(dedans)
  await modale
    .getByRole('radiogroup', { name: 'Liste' })
    .getByRole('radio', { name: nomListe, exact: true })
    .click()
  await modale.getByRole('button', { name: /^Ajouter/ }).click()
  await expect(modale).toBeHidden()

  // Sans filtre, les deux tâches cohabitent.
  await expect(tacheOuverte(page, dedans)).toBeVisible()
  await expect(tacheOuverte(page, dehors)).toBeVisible()

  // Avec le filtre, la liste ne garde que la sienne. L'identifiant se lit par l'API :
  // il n'apparaît nulle part à l'écran, et le fabriquer serait deviner.
  const { data } = await account.client
    .from('list')
    .select('id')
    .eq('name', nomListe)
    .single()

  await page.goto(`/taches?vue=toutes&liste=${(data as { id: string }).id}`)
  await expect(tacheOuverte(page, dedans)).toBeVisible()
  await expect(tacheOuverte(page, dehors)).toHaveCount(0)
})

test('les aide-mémoire ne sont pas des listes de tâches', async ({ page, account }) => {
  // Trois aide-mémoire sont posés à la création du compte (Courses, Idées,
  // Pense-bête). Ils vivent dans la même table que les listes mais n'en sont pas :
  // « Gérer les listes » ne doit proposer aucun d'eux, sinon on offrirait de
  // supprimer ce que le serveur refuse de supprimer (`list_memo_undeletable`).
  const { data } = await account.client.from('list').select('name, kind')
  const memos = (data as { name: string; kind: string }[]).filter((l) => l.kind !== 'task')
  expect(memos.map((m) => m.name).sort()).toEqual(['Courses', 'Idées', 'Pense-bête'])

  await page.goto('/taches?listes=1')
  const gestion = page.getByRole('dialog', { name: 'Gérer les listes' })
  await expect(gestion).toBeVisible()

  for (const memo of memos) {
    await expect(gestion.getByLabel(`Nom de la liste ${memo.name}`)).toHaveCount(0)
  }
})
