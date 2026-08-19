import { expect, test } from '../fixtures/auth'
import { formatLongDate } from '../../src/lib/appDate'
import {
  addDays,
  appToday,
  createHabit,
  createMilestones,
  createObjective,
  deleteAllObjectives,
  lundiDeLaSemaine,
  numeroSemaineIso,
  trimestreDe,
} from '../helpers/data'
import { antidaterObjectif } from '../helpers/sqlLocal'
import { unique } from '../helpers/unique'

// Le rituel hebdomadaire : le parcours le plus riche du produit, et le seul écran qui
// traite LES TROIS types d'objectifs côte à côte — son étape « réparation » affiche une
// carte par objectif, avec une mécanique différente selon la mesure.
//
// POURQUOI UNE SEMAINE PASSÉE, ET POURQUOI L'ANTIDATAGE
// -----------------------------------------------------
// Un rituel s'ouvre le vendredi 18 h (heure serveur), donc celui de la semaine EN COURS
// n'est pas accessible du lundi au vendredi après-midi. Une semaine révolue, elle, est
// toujours ouverte. Mais l'écran exige aussi que l'objectif ait existé pendant cette
// semaine, et `created_at` est posé par le serveur : d'où `antidaterObjectif`, sans quoi
// ce test ne tournerait que le week-end.
//
// `formatLongDate` est importée de l'app : c'est un formateur de dates servant à TROUVER
// un bouton, pas une copie qu'on vérifierait. La règle « ne jamais importer la copie de
// l'app dans un test » vise les libellés qu'on assert, qui deviendraient tautologiques.

test.afterEach(async ({ account }) => {
  await deleteAllObjectives(account.client, account.userId)
})

test('dérouler le rituel d’une semaine passée, sur les trois types d’objectifs', async ({
  page,
  account,
}) => {
  const suffixe = unique()
  const today = await appToday(account.client)

  const lundiCible = addDays(lundiDeLaSemaine(today), -7)
  const semaine = numeroSemaineIso(lundiCible)
  const annee = Number(lundiCible.slice(0, 4))
  const trimestre = trimestreDe(lundiCible)
  const jourARattraper = addDays(lundiCible, 2) // un mercredi, forcément passé

  // Trois objectifs annuels, un par mesure : la fenêtre d'un objectif annuel couvre
  // toute l'année, donc elle inclut la semaine visée quel que soit le jour du test.
  const habitude = await createHabit(account.client, account.userId, {
    label: `H${suffixe.slice(0, 4)}`,
    title: `Courir ${suffixe}`,
    year: annee,
    cadence: 3,
  })
  const quantite = await createObjective(account.client, account.userId, {
    label: `Q${suffixe.slice(0, 4)}`,
    title: `Épargner ${suffixe}`,
    measure: 'quantite',
    year: annee,
    periodUnit: 'week',
    entryMode: 'cumul',
    startValue: 0,
    targetValue: 6000,
    direction: 'atteindre',
    unit: '€',
  })
  const jalons = await createObjective(account.client, account.userId, {
    label: `J${suffixe.slice(0, 4)}`,
    title: `Permis bateau ${suffixe}`,
    measure: 'jalons',
    year: annee,
  })
  const etape = `Réviser le code ${suffixe}`
  await createMilestones(account.client, jalons, annee, trimestre, [etape])

  // La précondition que l'API ne sait pas poser.
  const veille = addDays(lundiCible, -30)
  for (const objectif of [habitude, quantite, jalons]) {
    await antidaterObjectif(objectif, veille)
  }

  await page.goto('/review')

  // La grille montre les semaines d'un trimestre : si la semaine visée est dans le
  // précédent (début de trimestre), il faut changer d'onglet.
  if (trimestre !== trimestreDe(today)) {
    await page.getByRole('radio', { name: new RegExp(`^Trimestre ${trimestre}`) }).click()
  }

  await page
    .getByRole('button', { name: new RegExp(`^Rituel de la semaine ${semaine},`) })
    .click()

  const rituel = page.getByRole('dialog', { name: 'Rituel de la semaine' })
  await expect(rituel).toBeVisible()

  // 1. Récapitulatif. Le bouton n'apparaît qu'après ~1,5 s d'animation : l'assertion
  //    réessaie, aucune attente manuelle n'est nécessaire.
  await rituel.getByRole('button', { name: 'Continuer →' }).click()

  // 2. Réparation — les trois mécaniques, dans le même écran.
  await expect(rituel.getByRole('heading', { name: 'Rien oublié ?' })).toBeVisible()

  //    Habitude : rattraper une séance oubliée, jour par jour.
  const jour = rituel.getByRole('button', { name: formatLongDate(jourARattraper) })
  await expect(jour).toHaveAttribute('aria-pressed', 'false')
  await jour.click()
  await expect(
    rituel.getByRole('button', { name: `${formatLongDate(jourARattraper)} — fait` }),
  ).toHaveAttribute('aria-pressed', 'true')

  //    Quantité : un relevé, pas une séance.
  await rituel.getByLabel(`Relevé pour Épargner ${suffixe}`).fill('250')
  await rituel.getByRole('button', { name: 'Noter' }).click()

  //    Jalons : une étape franchie.
  const jalon = rituel.getByRole('button', { name: etape, exact: true })
  await expect(jalon).toHaveAttribute('aria-pressed', 'false')
  await jalon.click()
  await expect(jalon).toHaveAttribute('aria-pressed', 'true')

  await rituel.getByRole('button', { name: 'Continuer →' }).click()

  // 3. Tri de la réserve. C'est « Terminer → » qui valide la session côté serveur, et
  //    l'étape n'avance que si l'écriture réussit.
  await rituel.getByRole('button', { name: 'Terminer →' }).click()

  // 4. Projection.
  await expect(rituel.getByRole('heading', { name: 'À ce rythme' })).toBeVisible()
  await rituel.getByRole('button', { name: 'Revenir au dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible()

  // La semaine porte désormais sa marque. On l'assert sur la carte et non sur la
  // bannière : celle-ci est repassée à la semaine EN COURS dès que le rituel en attente
  // a été validé, et cette semaine-là n'ouvrira que vendredi 18 h.
  await page.goto('/review')
  if (trimestre !== trimestreDe(today)) {
    await page.getByRole('radio', { name: new RegExp(`^Trimestre ${trimestre}`) }).click()
  }
  await expect(
    page.getByRole('button', { name: new RegExp(`^Rituel de la semaine ${semaine},.*, noté$`) }),
  ).toBeVisible()
})

test('une semaine antérieure à l’objectif ne s’ouvre pas', async ({ page, account }) => {
  const suffixe = unique()
  const today = await appToday(account.client)
  const lundiCible = addDays(lundiDeLaSemaine(today), -7)
  const semaine = numeroSemaineIso(lundiCible)
  const trimestre = trimestreDe(lundiCible)

  // Un objectif créé AUJOURD'HUI, donc sans antidatage : il n'existait pas la semaine
  // dernière. On ne passe pas en revue une semaine qu'on n'a pas vécue avec cet
  // objectif, et la carte le dit au lieu de proposer un rituel vide.
  await createHabit(account.client, account.userId, {
    label: `H${suffixe.slice(0, 4)}`,
    title: `Nager ${suffixe}`,
    year: Number(today.slice(0, 4)),
  })

  await page.goto('/review')
  if (trimestre !== trimestreDe(today)) {
    await page.getByRole('radio', { name: new RegExp(`^Trimestre ${trimestre}`) }).click()
  }

  const carte = page.getByRole('button', {
    name: new RegExp(`^Semaine ${semaine}, .* : aucun objectif à passer en revue$`),
  })
  await expect(carte).toBeVisible()
  await expect(carte).toBeDisabled()
})
