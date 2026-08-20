import { expect, test } from '../fixtures/auth'
import { appToday, createTask } from '../helpers/data'
import { unique } from '../helpers/unique'

// Le réveil de l'onglet : ce qui se passe quand on revient sur l'application après
// l'avoir laissée de côté.
//
// La régression visée est précise. TanStack conserve les données quand un
// rafraîchissement en arrière-plan échoue, mais passe quand même la query en erreur :
// l'accueil affichait donc « Impossible de charger ces données » PAR-DESSUS un écran
// complet et utilisable, avec un bouton « Réessayer » qui ne relançait rien, et il
// fallait recharger la page pour l'enlever.
//
// Un seul test E2E, parce qu'il vérifie un CÂBLAGE (l'écran se tait, la coquille
// parle). La matrice de cas — quelle erreur se montre, laquelle se retente — vit dans
// `src/lib/queryError.test.ts`, `src/lib/retryPolicy.test.ts` et
// `src/hooks/useQueriesState.test.ts`.

test('un rafraîchissement raté au réveil ne casse pas l’accueil', async ({ page, account }) => {
  const suffixe = unique()
  const titre = `Arroser les plantes ${suffixe}`
  const today = await appToday(account.client)
  await createTask(account.client, account.userId, { title: titre, dueDate: today })

  // L'horloge fausse est le seul moyen de simuler la nuit : le refetch de réveil ne
  // relance que les queries PÉRIMÉES, et le `staleTime` de l'écran va jusqu'à 5 min.
  // Six minutes suffisent à toutes les périmer, et restent très loin de l'heure de
  // validité du jeton — on teste la reprise, pas le renouvellement.
  await page.clock.install()

  await page.goto('/')
  await expect(page.getByText(titre)).toBeVisible()

  // À partir d'ici, plus rien n'atteint PostgREST. C'est exactement ce que vit un
  // téléphone qui se réveille sur un réseau qui n'est pas encore là.
  //
  // Les tentatives sont comptées : c'est le seul repère fiable pour savoir QUAND
  // une query est passée en erreur. Les délais sont tirés au hasard (jitter), donc
  // ni une durée fixe ni l'apparition d'un autre élément ne disent que celle-ci a
  // fini — et une assertion posée trop tôt ne constate rien.
  let appels = 0
  await page.route('**/rest/v1/**', (route) => {
    if (route.request().url().includes('/rpc/app_today')) appels += 1
    return route.abort('failed')
  })

  await page.clock.fastForward('06:00')
  await page.clock.resume()

  // Le réveil : l'onglet part, puis revient. La descente à `hidden` compte autant que
  // la remontée — `focusManager` ne prévient ses abonnés que sur un changement.
  const visibilite = (etat: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { value, configurable: true })
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    }, etat)

  await visibilite('hidden')
  await visibilite('visible')

  // Une tentative, puis les quatre du backoff : au-delà, la query a rendu les armes
  // et porte son erreur. C'est l'instant où l'ancien code vidait l'écran.
  await expect.poll(() => appels, { timeout: 20_000 }).toBeGreaterThanOrEqual(5)

  await expect(page.getByRole('status').getByText('Hors ligne')).toBeVisible({
    timeout: 20_000,
  })

  // Ce qui ne doit PAS arriver : le bloc rouge, ni l'écran vidé de son contenu.
  // Les deux sont arrivés, et pour la même raison — `error` non nul alors que les
  // données sont toujours là.
  await expect(page.getByText('Impossible de charger ces données')).toHaveCount(0)
  await expect(page.getByText('Impossible de charger le dashboard')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Réessayer' })).toHaveCount(0)
  await expect(page.getByText(titre)).toBeVisible()

  // Et au retour du réseau, l'écran se répare tout seul : aucun geste demandé.
  await page.unroute('**/rest/v1/**')
  await visibilite('hidden')
  await visibilite('visible')
  await expect(page.getByRole('status').getByText('Hors ligne')).toHaveCount(0, {
    timeout: 20_000,
  })
})
