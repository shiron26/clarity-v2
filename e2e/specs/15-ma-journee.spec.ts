import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'
import { expect, test } from '../fixtures/auth'
import { addDays, appToday, createTask } from '../helpers/data'
import { tacheCochee, tacheOuverte } from '../helpers/locators'
import { LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from '../local'
import { unique } from '../helpers/unique'

// « Ma journée » : le câblage du parcours, une fois. Le collecteur Google est
// simulé par ce qu'il fait réellement (un appel `anon` à la RPC d'ingestion avec
// un jeton personnel) ; la matrice des règles (validation, remplacement,
// 29 février, résumé) vit dans supabase/tests/04_ma_journee.sql.

test('la journée rassemble tâches, agenda, mails et anniversaires', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const [, month, day] = today.split('-').map(Number)
  const tache = `Appeler le notaire ${suffixe}`
  const rdv = `Séminaire ${suffixe}`
  const objet = `Contrat ${suffixe}`

  await createTask(account.client, account.userId, { title: tache, dueDate: today })

  // Préparer par l'API : un jeton, puis l'instantané tel que l'enverrait le script.
  const { data: jeton, error: jetonError } = await account.client.rpc('create_ingest_token', {
    p_label: `e2e ${suffixe}`,
  })
  expect(jetonError).toBeNull()

  const collecteur = createClient<Database>(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: ingestError } = await collecteur.rpc('ingest_daily_snapshot', {
    p_token: jeton!,
    p_payload: {
      version: 1,
      // Une journée entière s'exprime en dates : aucun fuseau à deviner côté test.
      window: { start: `${addDays(today, -1)}T12:00:00Z`, end: `${addDays(today, 2)}T00:00:00Z` },
      events: [
        { source_id: `ev-${suffixe}`, calendar: 'Perso', title: rdv, location: null,
          all_day: true, start: today, end: addDays(today, 1) },
      ],
      emails: [
        { source_id: `th-${suffixe}`, from_name: 'Sidney', from_email: 'sidney@clarity.test',
          subject: objet, received_at: new Date().toISOString(), important: true,
          url: `https://mail.google.com/mail/u/0/#inbox/${suffixe}` },
      ],
      birthdays: [
        { source: 'contacts', source_id: `people/${suffixe}`, name: 'Marie Dupont',
          first_name: 'Marie', month, day, year: null, phone: '33612345678' },
      ],
    },
  })
  expect(ingestError).toBeNull()

  // Vérifier par l'interface.
  await page.goto('/ma-journee')
  await expect(page.getByRole('heading', { name: 'Ma journée', exact: true })).toBeVisible()
  await expect(page.getByText(rdv, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mails importants', exact: true })).toBeVisible()
  // Toute la ligne est le lien : son nom porte l'expéditeur, l'heure et l'objet.
  await expect(page.getByRole('link', { name: new RegExp(objet) })).toHaveAttribute(
    'href',
    `https://mail.google.com/mail/u/0/#inbox/${suffixe}`,
  )
  // « Lui écrire » propose WhatsApp ou la messagerie du téléphone ; WhatsApp
  // s'ouvre dans un nouvel onglet, le message déjà rédigé.
  // Le test ne sort pas sur Internet : seule l'adresse demandée compte.
  await page.context().route(/wa\.me|whatsapp\.com/, (route) => route.fulfill({ body: '' }))
  await page.getByRole('button', { name: 'Lui écrire', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Messages', exact: true })).toBeVisible()
  const [whatsapp] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('menuitem', { name: 'WhatsApp', exact: true }).click(),
  ])
  expect(whatsapp.url()).toMatch(/^https:\/\/wa\.me\/33612345678\?text=Joyeux%20anniversaire%20Marie%20!/)
  await whatsapp.close()

  // La seule écriture de l'écran : cocher, avec les règles de /taches. La tâche
  // cochée reste affichée (barrée) au lieu de quitter la liste.
  await tacheOuverte(page, tache).click()
  await expect(tacheCochee(page, tache)).toBeVisible()
  await page.reload()
  await expect(tacheCochee(page, tache)).toBeVisible()
})
