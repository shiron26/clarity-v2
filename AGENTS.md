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
  barres mobiles), `objectives/` (`ObjectiveCard`, `ObjectiveHeatmap`, `ProgressRing`
  — partagés par le dashboard et l'écran Objectifs). Un composant qui ne sert qu'à une
  feature reste dans la feature. **Un composant partagé ne consomme jamais le contexte
  d'une feature** : `ObjectiveCard` reçoit `privacy` / `showMilestones` en props, c'est
  ce qui lui permet de servir deux écrans.
- Pas de barrel files (`index.ts` de re-export) : imports directs.
- Un composant « page » par route, dans `features/*/pages/`.

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
- Composer les classes avec `cn()` (`src/lib/cn.ts`). Toute nouvelle taille `--text-*`
  ou ombre `--shadow-*` doit être déclarée dans `extendTailwindMerge` de ce fichier,
  sinon tailwind-merge la prend pour une couleur et écrase la vraie.

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
- TanStack Query **met les retries en pause dans un onglet hors ligne**
  (`networkMode: 'online'`) et les reprend au retour du réseau. Attendu — mais cela
  fausse tout test de retry piloté depuis un onglet d'automatisation.
