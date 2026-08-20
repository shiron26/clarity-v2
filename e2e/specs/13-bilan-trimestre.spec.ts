import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../fixtures/auth'
import {
  appToday,
  createHabit,
  createMilestones,
  createObjective,
  deleteAllObjectives,
  trimestreDe,
} from '../helpers/data'
import { antidaterObjectif } from '../helpers/sqlLocal'
import { unique } from '../helpers/unique'

// Le bilan de trimestre : la cérémonie qui conclut une période. Même contrainte
// d'ouverture que le rituel (dernier vendredi du trimestre à 18 h, donc tout trimestre
// révolu est ouvert) et même exigence d'antériorité — `objectivesForQuarter` écarte les
// objectifs qui n'existaient pas encore, d'où l'antidatage.
//
// Il exerce les DEUX écrans de jugement, qui ne se choisissent pas au hasard
// (`verdictExpected`) :
//   · un objectif dont la fenêtre se ferme avec le trimestre → « Atteint / Pas atteint » ;
//   · un objectif annuel, qui continue → une note du trimestre.
// Le test crée donc un objectif de chaque sorte.

/** Le premier jour d'un trimestre civil. */
function debutTrimestre(annee: number, trimestre: number): string {
  return `${annee}-${String(trimestre * 3 - 2).padStart(2, '0')}-01`
}

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

test('dérouler le bilan d’un trimestre révolu, verdict et note', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const annee = Number(today.slice(0, 4))
  const trimestreCourant = trimestreDe(today)

  // Une année révolue est ARCHIVÉE (`is_archived(year) = year < année courante`) : on
  // ne peut donc pas y créer d'objectif, et le trimestre passé doit appartenir à
  // l'année en cours. En janvier-mars, il n'y en a aucun — ce test ne peut pas exister.
  test.skip(
    trimestreCourant === 1,
    'Aucun trimestre révolu dans l’année en cours : l’année précédente est archivée.',
  )

  const cible = trimestreCourant - 1
  const veille = debutTrimestre(annee, cible)

  // Annuel : sa fenêtre dépasse le trimestre, il attend une NOTE.
  const annuel = await createHabit(account.client, account.userId, {
    label: `A${suffixe.slice(0, 4)}`,
    title: `Courir ${suffixe}`,
    year: annee,
    cadence: 3,
  })
  // Trimestriel sur la cible : sa fenêtre se ferme avec elle, il attend un VERDICT.
  const trimestriel = await createObjective(account.client, account.userId, {
    label: `T${suffixe.slice(0, 4)}`,
    title: `Permis bateau ${suffixe}`,
    measure: 'jalons',
    year: annee,
    quarter: cible,
  })
  await createMilestones(account.client, trimestriel, annee, cible, [`Code ${suffixe}`])

  for (const objectif of [annuel, trimestriel]) {
    await antidaterObjectif(objectif, veille)
  }

  await page.goto(`/bilan/${annee}/t${cible}`)

  const bilan = page.getByRole('dialog', { name: `Bilan du trimestre ${cible}` })
  await expect(bilan).toBeVisible()

  // 1. Récapitulatif — on mène avec ce qui a été fait, jamais avec ce qui manque.
  await bilan.getByRole('button', { name: 'Continuer →' }).click()

  // 2. Un écran par objectif principal. L'ordre suit les places, donc on ne le
  //    présuppose pas : chaque écran porte soit un verdict, soit une note.
  await jugerUnObjectif(page, bilan)
  await jugerUnObjectif(page, bilan)

  // 3. La suite : ce qu'on emporte dans le trimestre d'après.
  await bilan.getByRole('button', { name: 'Terminer le bilan →' }).click()

  // Terminer, c'est écrire : la cérémonie ne se ferme que si la validation aboutit.
  await expect(bilan).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/annee/${annee}/t${cible}$`))

  // Rouvert, le bilan est déjà validé : « Terminer » n'écrit plus, il referme.
  await page.goto(`/bilan/${annee}/t${cible}`)
  await expect(bilan).toBeVisible()
})

/**
 * Traverse un écran de jugement, quel qu'il soit.
 *
 * `verdictExpected` décide de l'écran selon que la fenêtre de l'objectif se ferme ou
 * non avec le trimestre. Le test ne rejoue pas cette règle — il la constate, et
 * traverse ce qu'il trouve.
 */
async function jugerUnObjectif(page: Page, bilan: Locator): Promise<void> {
  const verdict = bilan.getByRole('radiogroup', { name: /^Verdict — / })
  const note = bilan.getByRole('radiogroup', { name: /^Note du trimestre — / })

  await expect(verdict.or(note).first()).toBeVisible()

  if ((await verdict.count()) > 0) {
    await verdict.getByRole('radio', { name: 'Atteint', exact: true }).click()
  } else {
    await note.getByRole('radio', { name: /^En orbite/ }).click()
  }

  await page.getByRole('button', { name: /^(Objectif suivant|Continuer) →$/ }).click()
}
