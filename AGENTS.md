# Clarity v2 — Guide agents

Clarity est une SPA React qui parle **directement à PostgREST** (Supabase hosted,
`eu-west-3`) — aucune couche serveur sur le chemin des données. Les données sensibles
sont **chiffrées côté base** (pgcrypto + Vault). La spécification de référence est
[SPEC-CLARITY-BACKEND.md](./SPEC-CLARITY-BACKEND.md) : en cas de doute produit, elle tranche.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | dev server Vite (env : `.env.development.local` → stack locale, sinon `.env.local` → hosted) |
| `npm run typecheck` / `npm run lint` | `tsc -b` / oxlint — les deux doivent passer avant tout commit |
| `npm run build` | build de production |
| `npm run smoke` | test bout en bout PostgREST (`scripts/smoke.ts`) |
| `npm test` / `test:watch` | tests unitaires Vitest sur les fonctions pures (`src/**/*.test.ts`) — aucun prérequis |
| `npm run test:e2e` / `test:e2e:ui` | tests navigateur Playwright (`e2e/`) — exige la stack locale démarrée |
| `npm run seed:dev` | jeu de données local (objectifs, jalons, tâches, historique) — refuse de tourner ailleurs qu'en local |
| `npm run db:migration -- <nom>` | nouvelle migration |
| `npm run db:push:dry` puis `db:push` | **toujours dry-run d'abord** — pas de rollback facile sur le hosted |
| `npm run db:types:local` / `db:types` | régénérer `src/types/database.ts` depuis le local / le hosted — **obligatoire après chaque migration** |
| `npx supabase start` / `stop` / `status` | stack locale Docker (Studio : http://127.0.0.1:54323) |
| `npx supabase db reset` | rejoue migrations + seed en local, à volonté |
| `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_etancheite.sql` | tests SQL rejouables (aussi `02_regles_metier.sql`, `03_dashboard_reads.sql`) |

Développement : **toujours contre la stack locale** (`supabase start`, `db reset` librement).
Le hosted ne reçoit que des migrations validées en local.

### Le hosted est interdit aux agents

Le projet hosted (`bmmlzydvsfjlfogrgklf`) porte des **comptes réels**. Un agent n'y
lance jamais rien : ni test, ni seed, ni reset, ni « nettoyage », ni requête d'inspection.
Concrètement, sont **interdits** :

- `npm run smoke` sans `SUPABASE_URL` local (sans variable il lit `.env.local` → hosted,
  et il crée des comptes) ;
- `npm run db:push`, `supabase db push`, `supabase link` / `unlink`, `migration repair`,
  et tout `--linked` autre qu'une lecture (`gen types`, `migration list`, `db dump`) ;
- toute connexion Postgres non locale (`psql "$DB_URL"` inclus : cible ambiguë) ;
- la clé `service_role` et la lecture de `.env.local` (qui contient l'URL hosted et cette clé).

Tout cela se fait en local : `npx supabase start`, `npx supabase db reset`, `npm run seed:dev`,
psql sur `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Si le hosted est
réellement nécessaire, **le demander à l'utilisateur** — lui seul lance la commande.

Ce n'est pas qu'une consigne : `.claude/hooks/block-hosted-supabase.sh` (PreToolUse/Bash)
refuse ces commandes, `permissions.deny` en double une partie, et `scripts/smoke.ts`
exige `CLARITY_ALLOW_HOSTED=1` pour viser le hosted. Ne pas contourner ces garde-fous.

## Règles base de données (intouchables)

Le détail vit dans les commentaires des migrations (`supabase/migrations/`). Résumé :

- Le front lit/écrit les **vues `public.*`** avec des colonnes **en clair** (`title`,
  `name`, `comment`…). Ne jamais toucher aux colonnes `_enc`, ne jamais exposer
  `private.enc`/`private.dec` aux rôles API (oracle de déchiffrement).
- Toute nouvelle entité chiffrée suit le pattern : table dans `private` + fonction
  `public.<entité>_rows()` SECURITY DEFINER (**le WHERE de la fonction EST la
  sécurité**) + vue `public.<entité>` par-dessus + triggers INSTEAD OF + **grants
  explicites** (ne jamais compter sur les default privileges — ils ne s'appliquent pas).
- Toute fonction SECURITY DEFINER : `set search_path = ''` + objets qualifiés.
- Migrations **petites et additives**. La clé Vault (`clarity_app_key`) n'apparaît
  jamais dans une migration ni dans le repo ; en local, `supabase/seed.sql` pose une
  clé de dev.
- Fuseau horaire : via `private.app_config` / `private.app_tz()` — jamais en dur.
- Les colonnes serveur (`completed_by`, `completed_at`, `closed_at`, `created_by`,
  `slot`…) sont imposées par les triggers, jamais confiées au client — et assignées à
  `NEW` pour que le RETURNING reflète la réalité. Pour `completed_at` et `closed_at`,
  la valeur envoyée par le client n'est lue que comme un signal booléen
  (null / non-null) : l'estampille vient de `now()`, jamais de l'horloge du navigateur.
  `slot` n'est jamais envoyé non plus : le serveur attribue le plus petit libre sous
  verrou et lève `slot_full` s'il n'en reste aucun. Idem `objective_entry.entry_date` :
  posée au jour applicatif, jamais choisie par le client.
- **L'unicité d'un slot porte sur le chevauchement de fenêtre**, pas sur l'année : deux
  contraintes d'exclusion GiST (`objective_slot_user_excl` / `_space_excl`) sur
  `window_range`, colonne générée depuis `(year, quarter)` par
  `private.objective_window()`. Conséquence côté front : une collision remonte en
  **`23P01`**, pas en `23505` — `queryError.ts` doit le classer, sinon elle se lit
  « erreur de notre côté ». Le verrou consultatif de l'attribution garde l'année comme
  clé, et c'est correct : les bornes étant `[début, fin)`, deux fenêtres ne peuvent se
  chevaucher que dans la même année.
- **`measure`, `period_unit`, `entry_mode`, `start_value` et `quarter` sont figés après
  création**, au même titre que `year`, `kind` et `slot` : changer l'unité de période
  orphelinerait l'historique d'`objective_period`, basculer cumul → relevé changerait
  rétroactivement le sens des saisies passées, et déplacer le point de départ
  ré-échelonnerait tous les pourcentages déjà lus. Changer de nature, c'est supprimer et
  recréer — le DELETE reste libre. Restent modifiables : le contenu, `cadence`
  (l'ajustement de rythme en dépend), `target_value`, `unit`, `direction`, `closed_at`.
- **Le sens d'une quantité (`direction`) se déduit, il ne se demande pas** : un point de
  départ au-dessus de la cible est un objectif à la baisse. Une seule définition côté
  front, `directionOf()` (`src/lib/objectiveDraft.ts`), appelée à la création comme à
  l'édition — la cible étant modifiable, la faire passer de 70 à 85 kg quand on part de 78
  retourne le sens, et `direction` doit suivre. Le pourcentage, lui, se calcule **toujours**
  par `quantityPercent()` (`src/lib/objectiveState.ts`) : la formule naïve `valeur / cible`
  suppose une montée depuis zéro, et elle affichait « cible atteinte » sur un objectif de
  perte de poids le jour de sa création.
- **La récurrence d'une tâche est une chaîne, pas une série.** La forme de la règle est
  validée en base (`task_recurrence_shape`, via `private.recurrence_is_valid`) : elle ne
  l'était que côté client, et un `weekdays` hors 1..7 faisait boucler `next_due` sans fin.
  `private.next_due` reste l'**unique** calcul de la prochaine échéance, jamais
  réimplémenté en TS — `public.skip_task_occurrence()` (passer son tour) s'en sert aussi,
  avec l'échéance sautée pour ancre et non le jour courant. Et **une occurrence ne se coche
  pas avant son échéance** : sans cette règle la suivante retombait sur la date qu'on
  venait de cocher, et chaque clic fabriquait un doublon.
- **Les contraintes en `CASE` se réécrivent, elles ne se complètent pas** : la branche
  `else` avale toute valeur non listée, donc ajouter une valeur de `kind` ou de
  `measure` casse la forme en silence.

## Règles front

### Structure

- `src/features/<domaine>/` = **tranches verticales** (hooks + pages + composants du
  domaine : `auth/`, `home/`, demain `tasks/`, `objectives/`, `reviews/`, `spaces/`).
  Une feature n'importe **jamais** depuis une autre feature — ce qui est partagé
  remonte dans `src/lib/` (infra non-React), `src/hooks/` (hooks transverses) ou
  `src/components/` (composants partagés).
- `src/components/` = ce que plusieurs features utilisent : `ui/` (primitives du
  design system : `Button`, `Field`, `Checkbox`, `EmptyState`…), `icons/` (SVG trait
  fin, un fichier par icône), `brand/` (`Logo`), `layout/` (`AppShell`, `Sidebar`,
  barres mobiles), `dnd/` (le glisser-déposer, partagé par les tâches, les listes et
  la grille d'accueil), `objectives/` (`ObjectiveCard`, `ObjectiveHeatmap`, `ProgressRing`
  — partagés par le dashboard et l'écran Objectifs). Un composant qui ne sert qu'à une
  feature reste dans la feature. **Un composant partagé ne consomme jamais le contexte
  d'une feature** : `ObjectiveCard` reçoit `privacy` / `showMilestones` en props, c'est
  ce qui lui permet de servir deux écrans.
- Une **modale ne s'ouvre pas par-dessus une modale** : deux `Modal` écoutent Échap en
  même temps. `TaskDeleteDialog` (`src/components/tasks/`) porte le choix « seulement
  cette fois / toute la série » pour les trois surfaces qui suppriment une ligne (écran
  Tâches, rituel, aide-mémoire) ; la feuille d'édition, elle, déplie le même choix dans
  son pied, avec la copie partagée de `taskDeleteCopy.ts` — recopier ce texte, c'est le
  laisser diverger sur ce que l'utilisateur perd.
- Pas de barrel files (`index.ts` de re-export) : imports directs.
- Un composant « page » par route, dans `features/*/pages/`.

**Les widgets du dashboard font exception à la règle « la page fetche, les blocs sont
muets »** (`src/features/home/widgets/`). Un widget est optionnel, duplicable et
réordonnable : la page ne peut pas charger pour un widget qui n'est peut-être pas monté.
Il est donc **autonome pour ses données** (sa query, son état vide, son erreur inline) et
**dépendant de la page pour les interactions** (`DashboardContext` : cocher une tâche dans
un widget allume la carte d'objectif dans un autre, ce qui exige une seule séquence de
complétion). Les queries se dédoublonnent d'elles-mêmes — mêmes keys que les autres
écrans, donc aucun appel réseau supplémentaire ; c'est ce qui rend l'autonomie gratuite.

La disposition (ordre, largeur ⅓/⅔/plein, instances) vit dans `dashboardLayout.ts`,
**client-only** comme les préférences qu'elle remplace, dans un format **versionné** —
c'est ce qui permet de reprendre une disposition ancienne une fois, sans faire revenir à
chaque rechargement un widget que l'utilisateur vient de retirer. Quatre règles qui ne se
devinent pas :

- une disposition lue du stockage est **toujours validée** : un widget retiré du code, une
  largeur bricolée, un aide-mémoire de nature inconnue ne doivent jamais produire une
  erreur à l'écran, seulement disparaître ;
- **un widget ne rend jamais `null`** — son enveloppe occuperait quand même sa cellule et
  laisserait un trou. Taire un widget est une décision de la PAGE, qui passe son
  identifiant dans `hidden` à `DashboardGrid` (le rituel se tait ainsi tant qu'un bilan
  attend), et ce filtre ne s'applique pas en mode Organiser ;
- **les largeurs se dérivent, elles ne se déclarent pas** : `spansOf()` rend les trois
  largeurs à un widget `mobile: true`, et seulement ⅔ et plein à un widget qu'on masque sur
  téléphone. Un widget qui tient sur 390 px tient dans un tiers d'écran. Corollaire : un
  widget large doit se replier sur sa **largeur réelle** (`span === 1`) et pas seulement
  sur le point de rupture, sinon il est illisible posé sur un tiers de grand écran ;
- **la bande d'objectifs et le bilan de trimestre sont épinglés**, hors grille. La première
  est l'identité de l'écran, le second se périme et ne se rattrape pas. Tout le reste,
  rituel compris, se déplace et se retire ;
- **les cartes d'une même ligne ont la même hauteur** : la grille n'aligne pas sur le haut
  (pas d'`items-start`) et `WidgetCard` prend `h-full`. Avec un plafond, sinon une liste de
  trente lignes étirerait ses voisines sur tout l'écran — et donc un corps en
  `overflow-y-auto`, sans quoi le contenu dépasserait par-dessus la ligne suivante. Un
  champ de capture se pose en bas de la carte étirée (`mt-auto`) plutôt que de flotter au
  milieu du vide.

Un identifiant de widget qui disparaît se traite dans `LEGACY_IDS` (alias vers son
remplaçant) plutôt qu'en laissant `sanitize` l'effacer : « Aujourd'hui » a fondu dans
« Votre semaine », et sans alias les comptes qui l'avaient posé auraient simplement perdu
leurs tâches du jour. Un alias suppose un `dedupe` derrière lui, sinon une disposition qui
portait les deux se retrouve avec deux fois le même widget. Et `dashboardLayout.ts` ne doit
**rien importer du registre** : le registre importe déjà le modèle, et le cycle rend un
écran blanc (`Cannot access '…' before initialization`) — d'où `isDuplicable()` du côté du
modèle.

### Style — Tailwind d'abord

- **Tailwind v4, config CSS-first** : tous les tokens de [DESIGN.md](./DESIGN.md) vivent
  dans le `@theme` de `src/index.css`. Pas de `tailwind.config.*`, pas de valeur en dur
  dans un composant quand un token existe (`bg-canvas`, `text-ink-2`, `rounded-2xl`,
  `shadow-card`…).
- **Pas de style inline, pas de CSS module.** Le CSS personnalisé est une exception
  réservée à ce que Tailwind n'exprime pas : `@keyframes`, `@utility` de dégradé de
  marque, `conic-gradient`. Tout le reste passe en `className`.
- Les couleurs dynamiques (couleur d'une liste/d'un objectif venant de la base) restent
  en `style={{ … }}` : elles ne peuvent pas être des classes statiques.
- **Un champ de saisie est blanc (`bg-surface`), toujours.** Le fond gris à la
  saisie a longtemps été recopié en `bg-canvas focus:bg-surface` de composant en
  composant : il faisait lire un champ vide comme un champ désactivé, et le
  passage au blanc au focus donnait un clignotement à chaque tabulation. Le gris
  reste réservé à `disabled` (`bg-surface-subtle`).
- **Un champ facultatif se replie derrière un `DisclosureLink`** (« + Ajouter une
  cible totale »). Affiché en permanence, il se lit comme une case à remplir et
  pousse à inventer une valeur : « trois fois par semaine en famille » n'a pas de
  total. Le champ s'ouvre déjà déplié quand il porte déjà une valeur.
- **`SegmentedGroup` à partir de trois choix, `OptionCard` en dessous.** Un segment
  ne porte qu'un mot : parfait pour une échelle qu'on lit d'un coup (1 à 7 séances,
  cinq récurrences), inutilisable quand il n'y a que deux réponses, où le choix
  mérite une phrase d'explication que seule une carte peut porter.
- **Seconde et dernière exception au « pas de style inline » : le `transform` et la
  `transition` d'un élément en cours de glissement.** Ils changent à chaque image,
  aucune classe ne peut les exprimer. Ils sortent **uniquement** de
  `useSortableItem` (`src/components/dnd/`), via `CSS.Translate.toString()` de
  `@dnd-kit/utilities` ; un composant les reçoit en objet opaque et les fusionne
  avec ses propres couleurs, il ne les écrit jamais lui-même.
- Composer les classes avec `cn()` (`src/lib/cn.ts`). Toute nouvelle taille `--text-*`
  ou ombre `--shadow-*` doit être déclarée dans `extendTailwindMerge` de ce fichier,
  sinon tailwind-merge la prend pour une couleur et écrase la vraie.

### Réordonnancement

Tout glissement passe par **`@dnd-kit`** et par `src/components/dnd/`. Il n'y en a
pas de deuxième implémentation, et il n'y en a plus de maison : `useDragOrder.ts`
réagençait à `elementFromPoint`, sans copie qui suit le pointeur ni animation des
voisins, et il fallait le recâbler à la main dans chaque écran.

- `SortableContainer` porte le `DndContext`, les capteurs, la détection de
  collision, les annonces et la copie qui suit le pointeur. Une surface = un
  conteneur. **Deux rendus de la même liste = deux conteneurs** : l'écran Tâches
  monte sa version desktop et sa version mobile en même temps, et deux éléments
  déplaçables ne peuvent pas partager un identifiant dans un seul contexte.
- `useSortableItem` est le **seul appelant de `useSortable`** du dépôt. Un
  composant réutilisé hors glissement ne l'appelle jamais lui-même : `TaskListRow`
  sert aussi la section « en retard », rendue hors de tout contexte, d'où les
  enveloppes `SortableTaskRow` / `SortableTaskRowCompact` / `SortableWidgetCell`
  qui isolent le hook.
- **La poignée est obligatoire et unique** (`DragHandle`). C'est son `touch-none`
  qui empêche le navigateur de défiler depuis ce point, et donc ce qui permet de se
  passer d'un délai d'appui long au doigt. Saisir une ligne entière exigerait au
  contraire un `TouchSensor` avec `delay`.
- **Le chemin clavier vient du `KeyboardSensor`**, pas de nous : Espace ou Entrée
  pour saisir, flèches pour déplacer, Espace ou Entrée pour déposer, Échap pour
  annuler. Les annonces françaises et les instructions vivent dans
  `dndAccessibility.ts` et nulle part ailleurs. **Ne jamais ajouter d'`aria-live`
  maison à côté** : dnd-kit rend déjà sa région live, et tout doublon fait lire
  chaque déplacement deux fois.
- Deux dispositions, et le choix n'est pas cosmétique. `layout="list"` laisse
  `verticalListSortingStrategy` calculer l'aperçu. `layout="grid"` **réagence pour
  de vrai** pendant le geste (`onDragOver` + `animateLayoutChanges` forcé), parce
  que les cellules de l'accueil font un tiers, deux tiers ou toute la largeur :
  une stratégie qui permute des rectangles supposés identiques y poserait les
  cartes sur l'empreinte de leurs voisines.
- **Le rang annoncé se calcule dans les gestionnaires, jamais depuis l'ordre
  affiché.** La liste ne bouge qu'au dépôt, la grille s'est déjà réagencée : aucune
  des deux lectures ne vaut pour l'autre. `SortableContainer` tient donc un
  `rankRef`, et c'est fiable parce que dnd-kit appelle toujours le gestionnaire de
  props **avant** les annonces.
- La persistance ne change pas : `useReorderTasks` / `useReorderLists`
  (`{ orderedIds, positions }`, où `positions` porte les positions **serveur
  d'avant le geste**, parce que leur `onMutate` a déjà réécrit le cache), et
  `setOrder` du `DashboardLayoutProvider` pour l'accueil, qui reste client-only.

### Données serveur

- **TanStack Query exclusivement** pour le server state : jamais de copie de données
  serveur dans un state local, un context ou un store. Pas de state manager global
  tant qu'un vrai state client partagé ne l'exige pas.
- Query keys **uniquement** via la fabrique `src/lib/queryKeys.ts` — jamais de key
  littérale inline. Les keys sont hiérarchiques : invalider `queryKeys.task.all`
  couvre toutes les vues de tâches.
- Dans un `queryFn` : `if (error) throw error` (le client supabase ne throw pas).
  `enabled` sur la présence de session/ids. Modèle : `src/hooks/useProfile.ts`.
- Mutations : `useMutation` + invalidation via la fabrique. Optimistic updates
  réservés aux interactions à haute fréquence (cocher une tâche, réordonner), avec
  rollback en `onError`. Jamais de `refetch()` manuel là où une invalidation suffit.
- **Écrire dans une vue chiffrée passe par `updateView()` / `insertView()` /
  `deleteView()` (`src/lib/viewWrites.ts`)** : `supabase gen types` n'émet
  `Insert`/`Update` que pour les vraies tables, une vue n'a qu'une `Row`. Le helper
  concentre l'unique cast et interdit au passage d'envoyer les colonnes serveur.
  `profile`, `review` et `objective_entry` sont des tables claires : écriture
  directe, elles ont leurs types `Insert`/`Update`. `objective_period` n'a qu'un
  grant `select` — toute écriture partirait en 42501.
- **Pas d'embedding PostgREST** sur `task` / `objective` / `list` / `milestone` /
  `space` / `review_item` : ce sont des vues, sans métadonnée de clé étrangère
  (`Relationships: []`). Charger séparément et joindre en mémoire.

### Wording

Les concepts du produit (places, cadence, relevé, horizon) ne vont pas de soi :
le texte est le seul accompagnement dont dispose l'utilisateur. Il est donc
**court, concret, et il dit à quoi sert ce qu'on demande** avant de le demander.

- **Pas de tiret cadratin (`—`) dans les textes visibles.** C'est la signature
  d'une copie écrite par une IA, et elle se repère immédiatement. Une virgule,
  un point ou deux-points font le même travail. La règle porte sur ce que
  l'utilisateur lit (titres, sous-titres, libellés, aides, messages d'erreur,
  états vides), pas sur les commentaires de code.
- Une information n'est dite **qu'une fois** dans un parcours. Répéter la même
  réassurance sur trois écrans la transforme en bruit.
- Pas de réassurance avant que l'inquiétude existe, pas de conséquence annoncée
  sans être nommée (« ce choix décide de ce que l'application vous demandera »
  ne dit rien tant qu'on ne dit pas quoi).
- Les libellés d'un choix disent **ce que l'option fait**, pas seulement son
  nom : sans cela l'utilisateur tranche à pile ou face.
- Le jargon interne (`T3`, « annuel / trimestriel », « principal / secondaire »,
  « slot ») ne sort jamais à l'écran quand une date ou un mot courant existe.
- Les titres et sous-titres des questions de création d'objectif vivent dans
  `src/components/objectives/draft/copy.ts`, jamais recopiés : deux parcours
  posent les mêmes questions.

### Erreurs

- **Aucun message serveur brut à l'écran.** `error.message` est en anglais et porte
  du jargon PostgREST : passer par `dataErrorMessage()` / `authErrorMessage()`
  (`src/lib/errorMessage.ts`). Le détail technique part en `console.error` via le
  `QueryCache.onError` de `src/lib/queryClient.ts`. `ErrorState` (bloc + bouton
  « Réessayer ») pour un échec de chargement, `Alert` pour une phrase inline.
- **Classer une erreur passe par `src/lib/queryError.ts`**, jamais à la main. Deux
  pièges de forme : avec `if (error) throw error`, postgrest-js throw un objet nu
  `{ message, details, hint, code }` — pas une instance de `PostgrestError`, et
  **sans status HTTP** (il reste sur la réponse). Et une panne réseau produit
  `code: ''`, pas `undefined` : tout test du genre `typeof code === 'string'`
  range l'offline avec les erreurs métier et le rend non retentable.
- Les seules erreurs retentables sont `authTransient` (PGRST301) et `offline`.
  **Ne jamais répondre à un PGRST301 par un `refreshSession()`** : voir les pièges.
- Les règles métier des triggers (`slot_full`, `milestone_cap`,
  `objective_archived_read_only`…) arrivent **toutes en `P0001`**, seule la chaîne les
  distingue — et certaines portent un suffixe `: détail`, d'où la comparaison sur le
  préfixe. Elles sont traduites dans la table `BUSINESS_RULES` de `errorMessage.ts` :
  ajouter une règle serveur, c'est ajouter sa copie ici, sinon l'utilisateur lit
  « une erreur est survenue de notre côté ».

### Dates et progression

- **« Aujourd'hui » vient du serveur** (`useAppToday` → `public.app_today()`), jamais
  de l'horloge du navigateur : le fuseau est unique pour tous (SPEC §2) et illisible
  côté client. Toute l'arithmétique dérive de cette ancre via `src/lib/appDate.ts`
  (fonctions pures sur des chaînes `YYYY-MM-DD`, semaine ISO lundi→dimanche).
- Pour comparer un **`completed_at` / `closed_at`** (timestamptz) à « aujourd'hui »,
  il faut l'instant, pas la date : `useAppDayStart` → `public.app_day_start()`.
  C'est ce qui borne la section « Terminées » de l'écran Tâches à la journée en
  cours (SPEC §5), via l'option `completedSince` de `useTasks` — sinon la vue
  « Toutes » rapatrie tout l'historique des tâches cochées.
- **`objective_period` fait foi pour la progression** — jamais recalculée depuis les
  tâches du cache. La période est la semaine ou le mois selon `objective.period_unit` :
  l'indexer par le seul numéro de période est ambigu dès qu'une grille de trimestre
  enjambe deux années ISO, d'où `periodKey(objectifId, unit, year, index)`
  (`src/hooks/useObjectivePeriods.ts`). Le détail jour par jour se lit via
  `public.objective_active_days()`, qui réutilise `private.credit_day` : **ne jamais
  réimplémenter cette règle en TS**. Même chose pour la **régularité** — 4 périodes
  closes, chacune plafonnée à 100 % — qui vit dans `public.objective_regularity()` et
  rend aussi les valeurs projetées pour que le front n'ait rien à recalculer.
- Cocher une tâche a deux effets serveur invisibles côté client (rafraîchissement du
  relevé hebdo, création de l'occurrence récurrente suivante) : invalider
  `task.all`, `objectivePeriod.all`, `objectiveRegularity.all` et
  `objectiveActiveDays.all`, pas seulement la ligne.

### Realtime — signal only

- **Le payload d'une notification ne se lit JAMAIS** (règle produit : il peut
  contenir des lignes chiffrées). Une notification = invalidation de queries, rien
  d'autre. Toujours passer par les hooks de `src/hooks/useRealtimeInvalidation.ts`.
- Canaux privés : nom **exact** `space:<uuid>` (policy DB à la regex près),
  `{ config: { private: true } }`, `await supabase.realtime.setAuth()` avant
  subscribe, flag `cancelled` autour de l'await (double-mount StrictMode).
- Deps des effets realtime : `status` / ids stables — **jamais l'objet `session`**
  (TOKEN_REFRESHED change son identité toutes les ~50 min).

### PWA — la coquille, jamais les données

- **Aucune réponse PostgREST ne va en Cache Storage.** Même statut que la règle
  Realtime ci-dessus : les vues `public.*` renvoient du clair déchiffré, l'écrire
  sur disque annulerait le chiffrement en base. Concrètement, `workbox.runtimeCaching`
  de `vite.config.ts` doit rester **vide** — sans route runtime, le service worker
  n'intercepte que la navigation et les assets same-origin précachés, et les appels
  cross-origin (REST + websocket Realtime) le traversent sans handler. La recette
  « NetworkFirst sur `/rest/v1/` » qu'on trouve partout est précisément ce qu'il ne
  faut pas coller ici.
- `registerType: 'prompt'` et `workbox.skipWaiting: false` vont ensemble : c'est ce
  qui laisse le nouveau SW en attente et rend `UpdateBanner` possible. Passer l'un
  des deux à l'autre valeur transforme silencieusement la bannière en code mort.
- `globPatterns` doit contenir `woff2` (Sora est auto-hébergée) mais **pas**
  `webmanifest` — le plugin l'ajoute déjà de son côté. Même piège pour
  `includeAssets` / `includeManifestIcons` : ils font doublon avec le glob.
- Un déploiement cassé reste servi depuis le cache jusqu'à ce que l'utilisateur
  accepte la mise à jour. Trappe de secours : déployer une fois avec
  `VitePWA({ selfDestroying: true })`, qui désenregistre le SW et purge les caches.
- Premier usage d'`env(safe-area-inset-*)` du dépôt (barres mobiles, feuilles
  ancrées en bas) : valeur arbitraire Tailwind assumée, au même titre que les
  couleurs dynamiques inline. Elle ne vaut que grâce à `viewport-fit=cover` dans
  `index.html`.
- Icônes : sources dans `assets/`, PNG versionnés dans `public/`, régénération par
  `./scripts/gen-icons.sh` (jamais branché sur `npm run build`).

### TypeScript / conventions

- `src/types/database.ts` est **généré** (`npm run db:types`), jamais édité à la main.
- `import type` obligatoire (`verbatimModuleSyntax`) ; pas d'`enum`
  (`erasableSyntaxOnly`) ; pas de `any`.
- Auth : consommer `useAuth()` (`status: 'loading' | 'signedOut' | 'signedIn'`) —
  jamais `supabase.auth.getSession()` directement dans un composant.
- Accessibilité minimale dès maintenant : labels sur les inputs, `type=` explicite
  sur les boutons, `role="alert"` sur les erreurs. Le design viendra des maquettes,
  la sémantique n'attend pas.

## Tests

Trois suites, et le partage entre elles n'est pas une question de goût :

| Suite | Ce qu'elle couvre |
|---|---|
| `supabase/tests/*.sql` | les règles serveur et l'étanchéité du chiffrement |
| `npm test` (Vitest) | les **fonctions pures** — la matrice de cas, les frontières |
| `npm run test:e2e` (Playwright) | le **câblage d'un parcours**, une fois par parcours |

> Un test E2E vérifie le câblage d'un parcours, une fois. La **matrice de cas** appartient
> aux tests unitaires. Un même parcours en douze variantes, c'est 1 test E2E et 11
> unitaires — sinon la suite passe de quinze secondes à dix minutes et finit désactivée.

Corollaire pratique : les copies de `BUSINESS_RULES` sont presque **intestables en E2E**,
parce que l'interface garde en amont (4ᵉ jalon inerte, 4ᵉ place désactivée, séance future
grisée). Elles relèvent d'un test unitaire sur `dataErrorMessage()`.

### Tests unitaires (`src/**/*.test.ts`)

Colocalisés, configurés par `vitest.config.ts` — **séparé de `vite.config.ts`**, qui n'a
pas à charger VitePWA et Tailwind pour des fonctions pures. Environnement `node` : le seul
module qui touche au navigateur est `dashboardLayout`, dont le test pose un faux
`localStorage` en trois lignes plutôt qu'un DOM entier. Pas de globals : chaque fichier
importe `describe`/`it`/`expect` de `vitest`.

On teste le **contrat exporté**, pas les fonctions privées : `sanitize`, `dedupe` et
`migrate` se vérifient à travers `readLayout`. Tester une fonction privée fige une
implémentation.

### Tests end-to-end (`e2e/`)

Playwright, contre **la stack locale exclusivement**. Le détail et les pièges vivent dans
[e2e/README.md](./e2e/README.md) ; ce qui suit ne se négocie pas.

- **Jamais le hosted.** `e2e/local.ts` lève à l'import si l'URL n'est pas locale, et
  `webServer.env` écrase les fichiers `.env` (dans Vite, `process.env` gagne) — sans quoi
  `.env.local`, chargé dans tous les modes, ferait viser le hosted. La clé anon locale est
  versionnée : c'est le JWT de démonstration public, pas un secret, et **aucun secret
  GitHub n'est nécessaire au workflow**.
- **Un compte par worker, jamais par test** : la stack locale plafonne à 30
  inscriptions/connexions par 5 minutes. La session est injectée par
  `context.addInitScript` (donc avant le boot de l'app, sinon `ProtectedRoute` a déjà
  redirigé), et la fixture pose `onboarded_at` comme le fait `useCompleteOnboarding`.
- **Préparer par l'API, vérifier par l'interface.** Un test de complétion ne doit pas
  tomber parce que le formulaire de création est cassé ; et une assertion en base
  testerait la base, plus le produit.
- **Sélecteurs par rôle, `exact: true` obligatoire** : `getByRole` compare en sous-chaîne,
  donc « Cocher X » matche aussi « Décocher X ». Les helpers partagés sont dans
  `e2e/helpers/locators.ts`. Pas de classe CSS, pas de `.first()` pour faire taire le mode
  strict — plusieurs surfaces sont montées deux fois (desktop + mobile), et l'ambiguïté est
  réelle.
- **Aucun `waitForTimeout`.** Les assertions web-first réessaient, ce qui suffit aux ~1,7 s
  de la séquence de complétion comme au 401 PGRST301 transitoire.
- **Ne pas forcer `reducedMotion`** dans la config : `useDoneSequence` sort immédiatement
  sous mouvement réduit, donc ni le flash ni le « pop » de la carte d'objectif ne se
  produisent — on testerait un autre produit.
- **Tout test qui crée un objectif le supprime** (`afterEach`) : 3 places principales, 5
  secondaires, et l'unicité porte sur le chevauchement de fenêtre.
- **`e2e/helpers/sqlLocal.ts` est réservé aux préconditions temporelles** que l'API ne sait
  pas poser — antidater `objective.created_at` pour qu'une semaine passée soit passable en
  revue. Jamais pour vérifier un résultat.

## Pièges connus (appris en construisant)

- `onAuthStateChange` : callback **strictement synchrone** — un `await` d'appel
  supabase dedans = deadlock (verrou interne supabase-js).
- `signUp` : `data.user && !data.session` = confirmation email requise (hosted) ;
  `identities.length === 0` = email déjà pris (réponse obfusquée — ne pas révéler
  l'existence d'un compte).
- StrictMode double-monte les effets en dev : tout effet realtime asynchrone doit
  pouvoir s'annuler proprement.
- Supprimer un utilisateur via le dashboard Supabase est bloqué par FK : **voulu**
  (spec : jamais de delete de profile) — passer par la RPC `delete_account()`.
- pg_cron s'exécute en **UTC** (job `clarity-weekly-backfill`, lundi 00:15 UTC).
- **401 `PGRST301` juste après un signup/signin.** GoTrue signe un token dont l'`iat`
  est l'instant présent, tronqué à la seconde ; si l'horloge du vérifieur retarde
  marginalement, PostgREST rejette les toutes premières requêtes en « JWT issued at
  future » pendant ~1 s, puis le token vieillit dans la validité. Vu en local, mais
  la cause est structurelle — le hosted est exposé aussi. C'est la **seule** erreur
  PostgREST transitoire : elle se retente (backoff court, `src/lib/queryClient.ts`),
  elle ne s'affiche pas. Ne **jamais** y répondre par un `refreshSession()` : le
  token est déjà frais, en redemander un minte un `iat` encore plus « futur ». Et
  c'est inutile même pour un token réellement expiré — chaque tentative re-résout
  son bearer via `auth.getSession()`, qui rafraîchit tout seul.
- **Échap pendant un déplacement au clavier fermait la modale.** Le
  `KeyboardSensor` de dnd-kit annule bien sur Échap, mais il écoute `document` en
  phase de **bullage** et ne s'y abonne qu'au début du geste : l'écouteur de
  `Modal`, posé à l'ouverture de la feuille, passe donc avant lui. Il ne suffisait
  pas que `Modal` ignore un évènement `defaultPrevented`, puisqu'à ce moment-là il
  ne l'était pas encore. La paire qui fonctionne : `SortableContainer` marque la
  touche en phase de **capture** tant qu'un geste est actif (sans couper la
  propagation, sinon dnd-kit ne la recevrait jamais), et `Modal` se tait devant un
  évènement déjà traité. Toute nouvelle interception clavier globale doit faire
  pareil.
- **Au clavier, en grille, les flèches ne sortaient pas de leur case.** Sans
  coordonnées de pointeur, la cible se déduit des seuls rectangles : celui de la
  carte déplacée, plus étroit, restait toujours le plus proche de lui-même dès que
  la voisine visée était plus large (un tiers contre pleine largeur). D'où
  `gridCollision` (`src/components/dnd/SortableContainer.tsx`), qui écarte la carte
  déplacée de la comparaison **et seulement au clavier** : à la souris elle doit
  rester candidate, sinon la grille se réagence dès le premier pixel. Le symptôme
  était muet, l'annonce ne disait rien et rien ne bougeait.
- **`DragOverlay` est portalisé dans `document.body`.** Un calque `position: fixed`
  rendu dans le panneau d'une modale dépend de l'absence de `transform` sur ce
  panneau, garantie aujourd'hui par le seul `animation-fill-mode: backwards` de
  `src/index.css` et par rien d'autre. Même famille de piège que `Popover`, avec
  une pièce mobile de plus ; le portail rend la question sans objet. Corollaire :
  **au repos, un élément déplaçable ne porte aucun `transform` dans le DOM** (c'est
  pour cela que `useSortableItem` passe par `CSS.Translate.toString(null)`, qui rend
  `undefined`), sinon chaque ligne deviendrait le bloc conteneur du `Popover` de sa
  propre échéance.
- **Décocher défait la génération, à une condition près.** `private.task.generated_from`
  (colonne privée, absente de la vue) relie une occurrence à celle dont la complétion l'a
  créée, dans le seul but d'annuler cette complétion : au décochage, l'occurrence engendrée
  est supprimée **si elle est encore décochée**. Si elle a déjà été cochée, elle porte du
  crédit et a peut-être engendré la sienne — on n'y touche pas. Sans ce lien, décocher puis
  recocher laissait deux tâches futures, et N cycles en laissaient N. C'est le seul lien
  entre occurrences : il ne fait pas une « série » (SPEC §4.3 amendée).
- TanStack Query **met les retries en pause dans un onglet hors ligne**
  (`networkMode: 'online'`) et les reprend au retour du réseau. Attendu — mais cela
  fausse tout test de retry piloté depuis un onglet d'automatisation.
