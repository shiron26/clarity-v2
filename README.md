# Clarity v2

SPA React (Vite) parlant directement à PostgREST (Supabase hosted, région `eu-west-3`).
Spécification de référence : [SPEC-CLARITY-BACKEND.md](./SPEC-CLARITY-BACKEND.md).

## Démarrage

```bash
npm install
cp .env.example .env.local   # remplir depuis le dashboard Supabase
npm run dev
```

### Mise en place du backend (une seule fois)

1. Créer le projet sur supabase.com — plan Free, région **eu-west-3 (Paris)**.
2. `supabase login` puis `supabase link --project-ref <ref>`.
3. Poser la clé de chiffrement dans le Vault (SQL Editor du dashboard) :
   ```sql
   select vault.create_secret('<openssl rand -base64 32>', 'clarity_app_key', 'Clé de chiffrement Clarity');
   ```
   La clé n'est **jamais** committée ni posée par une migration.
4. `npm run db:push:dry` puis `npm run db:push`, enfin `npm run db:types`.

## Conventions à connaître côté front

- **Le chiffrement est invisible.** Le client lit/écrit des colonnes en clair (`title`,
  `name`, `comment`…) sur les **vues** `public.*` ; le chiffrement se fait dans la base
  (vues déchiffrantes + triggers `INSTEAD OF`). Ne jamais toucher aux colonnes `_enc`.
- **Pas de recherche serveur** sur les champs chiffrés : la recherche se fait côté
  client, en mémoire, sur les tâches actives uniquement.
- **Realtime = signal, jamais payload.** Les notifications servent à invalider la query
  correspondante. Canaux : `postgres_changes` sur `public.review` (curseur de session),
  broadcast `space:<space_id>` pour l'invalidation des `review_item`.
- **Fuseau** : Europe/Paris pour tous, géré côté base (`private.app_config`).
  Semaine lundi → dimanche.
- La suppression de compte passe par la RPC `delete_account()` (soft delete). La
  suppression d'un utilisateur via le dashboard Supabase est bloquée par FK : c'est voulu
  (l'historique des espaces partagés ne doit jamais cascader).

## Vue Tâches — prédicats des 6 vues (SPEC §5)

Un seul composant, une seule requête paramétrée sur `public.task` :

| Vue | Prédicat (`due_date` = date seule) |
|---|---|
| Aujourd'hui | `due_date = aujourd'hui` + tâches en retard en **section distincte** |
| Demain | `due_date = demain` |
| Cette semaine | `due_date` entre aujourd'hui et dimanche (fenêtre qui rétrécit) |
| En retard | `due_date < aujourd'hui and completed_at is null` |
| Toutes | aucun filtre |
| Par liste | `list_id = ?` |

- Tâches cochées visibles, barrées, jusqu'à la fin du jour (Paris) :
  `completed_at is null or completed_at >= début du jour courant`.
- Tris/filtres non mémorisés. Défaut : par date (« Cette semaine », « Toutes »),
  manuel ou importance (« Aujourd'hui »).
- Report en masse : RPC `postpone_overdue_tasks()` (jamais les tâches d'espace).

## PWA

L'app est installable et se lance hors ligne. Le périmètre est volontairement
limité à la **coquille** : `vite-plugin-pwa` précache le build (HTML, JS, CSS,
police, icônes), et **rien d'autre**.

**Aucune donnée n'est mise en cache.** Les vues `public.*` renvoient du clair
déchiffré ; l'écrire dans le Cache Storage annulerait le chiffrement en base.
`workbox.runtimeCaching` reste donc vide : sans route runtime, le service worker
n'intercepte que la navigation et les assets same-origin, et les appels REST comme
le websocket Realtime le traversent sans être touchés. Hors ligne, l'app se peint
et les écrans de données affichent l'état d'erreur habituel.

Mises à jour : `registerType: 'prompt'`. Un nouveau service worker reste en attente
et `src/components/layout/UpdateBanner.tsx` propose de recharger — jamais de
rechargement surprise. Si un déploiement cassé se retrouve figé dans les caches des
utilisateurs, la trappe de secours est un déploiement avec
`VitePWA({ selfDestroying: true })`.

**Tester** : le service worker n'existe qu'en build (`devOptions.enabled: false`),
donc `npm run build && npm run preview`, jamais `npm run dev`. Pour le hors ligne,
couper le serveur de preview et recharger. Pour la bannière, garder l'onglet ouvert,
reconstruire, puis DevTools → Application → Service Workers → *Update* (en ayant
décoché « Update on reload », qui force `skipWaiting` et court-circuite la bannière).

**Icônes** : sources SVG dans `assets/`, PNG versionnés dans `public/`. Régénérer
avec `./scripts/gen-icons.sh` (nécessite `brew install librsvg imagemagick`) ; le
script n'est pas branché sur `npm run build`.

**Session en app installée** : « Rester connecté » disparaît de l'écran de connexion
et la persistance est forcée (`src/lib/displayMode.ts`). Le `sessionStorage` ne
survit pas au relancement d'une PWA — s'y appuyer déconnecterait à chaque ouverture.
À savoir sur iOS : une app ajoutée à l'écran d'accueil a une **partition de stockage
isolée de Safari**, donc sa première ouverture redemande toujours une connexion.
C'est le système, pas un bug.

**Hébergement** (Vercel, cf. `vercel.json`) : il faut un rewrite SPA vers
`index.html` et un `Cache-Control: no-cache` sur `sw.js`. Sans ce dernier, un service
worker périmé peut rester servi jusqu'à 24 h et la bannière ne se déclenche jamais.
Sur Vercel, utiliser `rewrites` et surtout pas `routes` : les rewrites ne s'appliquent
qu'après le système de fichiers, sinon `/sw.js` renverrait du HTML.

## Scripts

| Script | Rôle |
|---|---|
| `./scripts/gen-icons.sh` | régénérer les icônes PWA depuis `assets/` |
| `npm run db:migration -- <nom>` | nouvelle migration |
| `npm run db:push` / `db:push:dry` | pousser les migrations (dry-run d'abord !) |
| `npm run db:status` | état des migrations sur le projet lié |
| `npm run db:types` | régénérer `src/types/database.ts` |
| `npm run db:snapshot` | dump du schéma (`public` + `private`) |
| `npm run smoke` | test bout en bout (voir `scripts/smoke.ts`) |

Tests SQL rejouables : `supabase/tests/` (étanchéité du chiffrement, règles métier).
