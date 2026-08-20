# Tests end-to-end — guide de démarrage

Ces tests pilotent **un vrai navigateur** contre **la vraie base locale**. Ils ne
simulent rien : ils ouvrent une page, cliquent, tapent, et vérifient ce qui s'affiche.
C'est ce qui leur permet d'attraper ce qu'aucun autre test du dépôt ne voit — tout ce qui
casse **entre le clic et la base** : un `aria-label` renommé, une invalidation de query
oubliée, un pourcentage calculé à l'envers.

Le reste est déjà couvert ailleurs, et ces tests ne le refont pas : les règles serveur
vivent dans `supabase/tests/*.sql` (151 assertions), l'étanchéité du chiffrement dans
`01_etancheite.sql`.

## Lancer

```bash
npm test                # tests unitaires (fonctions pures), ~16 ms — aucun prérequis
npx supabase start      # une fois, si la stack locale ne tourne pas
npm run test:e2e        # tests navigateur, ~16 s
```

| Commande | Quand |
|---|---|
| `npm run test:e2e` | la suite complète |
| `npm run test:e2e:ui` | **à utiliser pour apprendre** : on voit chaque étape, on rejoue, on inspecte le DOM à n'importe quel moment du test |
| `npm run test:e2e:headed` | voir le navigateur travailler pour de vrai |
| `npm run test:e2e:report` | rouvrir le dernier rapport HTML |
| `npm run test:e2e:reset` | base locale repartie à neuf, puis la suite. **Efface le jeu de `seed:dev`** — à lancer sciemment, après une migration ou quand la base est encombrée |

Si la stack Supabase est éteinte, la suite s'arrête tout de suite avec un message qui le
dit, plutôt que d'accumuler vingt-sept délais d'attente.

## Lire un échec

Playwright dit toujours **ce qu'il attendait** et **ce qu'il a trouvé**. En cas d'échec il
laisse en plus une capture d'écran et une vidéo dans `test-results/`, et
`npm run test:e2e:report` ouvre le rapport complet.

Deux messages reviennent souvent, et ils veulent dire des choses très différentes :

- *element(s) not found* : le sélecteur ne correspond à rien. Presque toujours un libellé
  mal recopié (voir « apostrophes » plus bas) ou un élément qui n'est pas encore là.
- *strict mode violation: resolved to 2 elements* : le sélecteur correspond à **deux**
  éléments. Ce n'est pas un défaut de Playwright, c'est une vraie ambiguïté qu'il refuse
  de trancher au hasard. Voir « les pièges de ce dépôt ».

## La seule notion contre-intuitive : on n'attend pas une durée

Le réflexe naturel est « clique, attends 2 secondes, vérifie ». C'est la première cause de
tests instables : deux secondes suffisent sur ta machine et pas en intégration continue.

Playwright n'attend pas une durée, il **attend une condition**, en réessayant jusqu'à 7 s.

```ts
await expect(page.getByText('Courses')).toBeVisible()   // ✅ réessaie
expect(await locator.isVisible()).toBe(true)            // ❌ mesure une seule fois
await page.waitForTimeout(1000)                         // ❌ jamais, aucune exception
```

Cela suffit à absorber, sans une ligne d'attente :

- la séquence de complétion d'une tâche, en deux phases (~1,7 s) ;
- le bouton du premier écran du rituel, qui n'apparaît qu'après ~1,5 s d'animation ;
- le 401 `PGRST301` transitoire qui suit une connexion (~1 s), déjà retenté par
  `src/lib/queryClient.ts`.

## Écrire un test

```ts
import { expect, test } from '../fixtures/auth'

test('ce que fait l’utilisateur, et ce qu’il doit voir', async ({ page, account }) => {
  // 1. Préparer les données par l'API — pas par l'interface.
  await createTask(account.client, account.userId, { title: `Truc ${unique()}` })

  // 2. Agir par l'interface, sur ce que le test vérifie vraiment.
  await page.goto('/taches')
  await tacheOuverte(page, titre).click()

  // 3. Affirmer ce que voit l'utilisateur.
  await expect(anneau(page, 1, 3)).toBeVisible()
})
```

Quatre règles :

1. **On cible par rôle** (`getByRole`, `getByLabel`), jamais par classe CSS ni par chemin
   dans le DOM. Un sélecteur de rôle survit à une refonte Tailwind, et il échoue quand
   l'accessibilité se dégrade : le test rend deux services au lieu d'un.
2. **On prépare par l'API, on vérifie par l'interface.** Un test sur la complétion d'une
   tâche ne doit pas échouer parce que le formulaire de création est cassé. À l'inverse,
   une assertion passe toujours par l'écran : vérifier en base, ce serait tester la base
   et non le produit.
3. **Tout nom créé porte un suffixe unique** (`unique()`). C'est ce qui permet à plusieurs
   tests de partager un compte sans se marcher dessus.
4. **Tout test qui crée un objectif le supprime** (`deleteAllObjectives` en `afterEach`) :
   les places sont limitées à 3 principaux et 5 secondaires.

## Comment un test se retrouve connecté

`fixtures/auth.ts` crée **un compte par worker** (pas par test) via l'API, puis injecte sa
session dans `localStorage` avant le chargement de la page.

Trois choses à savoir :

- **Un compte par worker, et pas par test**, parce que la stack locale plafonne à
  **30 inscriptions/connexions par 5 minutes**. Un compte par test ferait échouer la suite
  dès la deuxième exécution rapprochée, avec une erreur qui n'a rien à voir avec le code.
- **L'injection se fait avec `context.addInitScript`**, donc avant tout script de la page.
  `AuthProvider` lit la session dès son montage : écrire après un `goto()` serait trop
  tard, `ProtectedRoute` aurait déjà redirigé vers `/login`.
- **La fixture pose `onboarded_at`**, exactement comme le fait `useCompleteOnboarding.ts`
  quand l'utilisateur termine l'onboarding. Sans ça, l'overlay opaque des premiers pas
  bloquerait tous les tests. Ce n'est pas un contournement : la colonne a un
  `grant update` explicite.

Deux fichiers n'utilisent pas cette fixture, et c'est voulu :
`01-inscription-onboarding` et `02-connexion-session` testent justement ces chemins-là.

## Les pièges de ce dépôt

Chacun a fait échouer un test pendant l'écriture de cette suite.

**1. Les apostrophes sont typographiques.** La copie utilise `’` (U+2019) et des
guillemets français `« »`. `getByText("Aujourd'hui")` ne trouvera **jamais**
`Aujourd’hui`, et le message d'erreur ne dira pas pourquoi. **Toute chaîne se copie-colle
depuis le fichier source**, jamais retapée. En dernier recours, une regex tolérante :
`/Aujourd.hui/`.

**2. `getByRole` compare en sous-chaîne par défaut.** `{ name: 'Cocher X' }` matche aussi
**« Décocher X »**. Le compte est alors faux d'exactement un, ce qui ressemble trait pour
trait à un bug de doublon. D'où `exact: true` partout, et les helpers de
`helpers/locators.ts`.

**3. Plusieurs surfaces sont montées deux fois.** L'écran Tâches rend sa version desktop
et sa version mobile en même temps (l'une masquée en CSS), et le rail de `/objectifs`
existe en `<nav>` et en `<select>`. `getByText(titre)` y résout à deux éléments. Cibler
par rôle règle le problème ; ajouter `.first()` ne ferait que masquer l'ambiguïté.

**4. Un même bouton change de nom selon la largeur.** Le texte est masqué sous 640 px et
le nom accessible bascule sur le `title` ou l'`aria-label` : « Ajouter ↵ » en desktop
devient « Ajouter la tâche » en mobile. Une regex (`/^Ajouter/`) couvre les deux.

**5. Une tâche cochée quitte le DOM.** Elle rejoint la section « Terminées », repliée par
défaut. Il faut la déplier (`deplierTerminees`), et ce helper est **idempotent** : le
bouton est une bascule, un second appel refermerait la section et l'assertion suivante
échouerait sur un « 0 élément » très trompeur.

**6. « Aujourd'hui » vient du serveur.** Jamais de `new Date()` dans un test : le fuseau
de l'application vit en base et n'est pas lisible côté client. On passe par
`appToday(client)`.

## Le rituel, et pourquoi il a besoin de SQL

Un rituel hebdomadaire s'ouvre le **vendredi 18 h** (heure serveur). Celui de la semaine
en cours n'est donc pas accessible du lundi au vendredi après-midi ; celui d'une semaine
révolue l'est toujours.

Mais l'écran exige **aussi** que l'objectif ait existé pendant cette semaine, et
`created_at` est posé par le serveur. Un test qui crée son objectif aujourd'hui ne peut
donc ouvrir que la semaine en cours — qui n'est ouverte que le vendredi soir. Sans
intervention, le parcours ne serait jouable que le week-end : sans valeur en intégration
continue.

D'où `helpers/sqlLocal.ts`, qui antidate `created_at` par une requête SQL sur la base
locale (via `docker exec`, ce qui marche à l'identique en CI). Son usage est **strictement
borné aux préconditions que l'API ne sait pas poser**. Jamais pour vérifier un résultat.

## Ce qui n'est pas couvert, et pourquoi

| Sujet | Où c'est couvert, ou pourquoi ça ne l'est pas |
|---|---|
| Règles serveur (places, plafonds, `next_due`, immutabilité) | `supabase/tests/02_regles_metier.sql` |
| Étanchéité entre comptes | `supabase/tests/01_etancheite.sql` |
| Bilans de trimestre et d'année | ouverture au dernier vendredi du trimestre : la précondition demanderait d'antidater bien plus que `created_at` |
| Glisser-déposer | seul le chemin clavier serait fiable, et un réordonnancement cassé n'empêche personne d'utiliser le produit. Premier candidat pour la suite |
| PWA, hors ligne | le service worker est désactivé en dev, et TanStack Query met ses retries en pause hors ligne : un test n'y observerait rien |
| Realtime | deux sessions simultanées, timing non déterministe. Couvert par `scripts/smoke.ts` |
| Régularité (« 4 dernières semaines ») | elle ne compte que des périodes **closes** : sur un compte neuf il n'y en a aucune, l'écran affiche `—` |
| Fonctions pures (`appDate`, `objectiveState`, `objectiveDraft`, `dashboardLayout`, `queryError`) | **couvertes par Vitest** — `npm test`, 82 assertions en 16 ms. Voir « L'autre moitié » ci-dessous |
| Espaces partagés | il n'y a pas d'interface : la base les supporte, `src/features/` n'a pas de dossier `spaces/` |
| Le bilan en janvier-mars | une année révolue est archivée, donc le trimestre passé doit être de l'année en cours. Le test se déclare `skip` au premier trimestre, avec sa raison |

## L'autre moitié : les tests unitaires

```bash
npm test          # 82 assertions, 16 ms
npm run test:watch
```

Cinq fichiers, colocalisés avec le code qu'ils testent (`src/lib/appDate.test.ts`…),
configurés par `vitest.config.ts` — séparé de `vite.config.ts`, qui n'a pas à charger
le plugin PWA pour des fonctions pures.

**La règle de partage entre les deux suites, et c'est la seule qui compte :**

> Un test E2E vérifie **le câblage d'un parcours, une fois**. La **matrice de cas**
> appartient aux tests unitaires.

Concrètement : l'E2E vérifie qu'un objectif à la baisse affiche bien 0 % à l'écran ;
les tests unitaires couvrent les neuf cas de `quantityPercent` (départ au-dessus,
en dessous, égal, dépassement, recul, cumul, sans cible…). Un seul parcours navigateur,
neuf assertions instantanées. L'inverse — neuf parcours navigateur — coûterait une
minute et couvrirait moins bien.

Ce que les tests unitaires attrapent et que l'E2E ne peut pas :

- les **frontières de dates** : le 1ᵉʳ janvier qui appartient à la semaine ISO de
  l'année précédente, le 29 février, l'an 2100 non bissextile. On ne fait pas tourner
  l'application au 31 décembre pour le vérifier ;
- les **dispositions corrompues** du dashboard : un widget retiré du code, une largeur
  bricolée, un aide-mémoire de nature inconnue, du JSON illisible ;
- le **classement des erreurs** : qu'un `23P01` soit lu comme un conflit et non comme
  « une erreur de notre côté », et qu'une panne réseau (`code: ''`, pas `undefined`)
  reste retentable.

Deux modules ne sont volontairement pas testés en unitaire : `recurrence.ts`, dont le
calcul d'échéance fait autorité **en base** (`private.next_due`, couvert par
`02_regles_metier.sql`), et tout ce qui touche React.

## Deux notes de configuration

- **La clé anon dans `local.ts` est versionnée, et ce n'est pas un secret** : c'est le JWT
  de démonstration identique sur toute stack Supabase locale, imprimé par
  `npx supabase status`. Son seul pouvoir est le rôle `anon`, entièrement soumis à la RLS,
  et il ne vaut que face au Postgres de la machine qui le lit. Ce qui doit rester secret,
  c'est `.env.local` — aucun test ne le lit, et **aucun secret GitHub n'est nécessaire au
  workflow**.
- **`.oxlintrc.json` désactive deux règles React sur `e2e/`** : le `use` des fixtures
  Playwright n'est pas le hook React `use`, et `({}, use)` est la signature documentée de
  Playwright. Deux faux positifs, rien de plus.

## Prouver qu'un test sert à quelque chose

Un test qui n'a jamais échoué n'a jamais rien prouvé. Les quatre régressions ci-dessous
ont été introduites volontairement, vérifiées, puis annulées — refaites-en une le jour où
vous doutez d'un test :

| Sabotage | Ce qui doit tomber |
|---|---|
| retirer `objectivePeriod.all` de `invalidateProgress` | `03-objectif-habitude` |
| remplacer `quantityPercent()` par `valeur / cible` | `04-objectif-quantite` |
| passer `union` en `union all` dans `refresh_objective_period` | le scénario « tâche + séance le même jour » |
| retirer le `delete … where generated_from` du décochage | `08-taches-recurrence` |
