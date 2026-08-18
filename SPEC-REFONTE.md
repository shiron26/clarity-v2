# Clarity — spécification de la refonte

Ce document décrit l'implémentation de la refonte validée en maquettes
(`maquettes/refonte.html`). Il complète [SPEC-CLARITY-BACKEND.md](./SPEC-CLARITY-BACKEND.md),
qu'il **amende sur deux points** (§0.1), et se lit avec [AGENTS.md](./AGENTS.md) pour les
conventions de code, qui restent inchangées.

**Une section = un écran.** Chaque section porte ses migrations s'il y en a, puis son front.
Le **§1 Socle** regroupe en tête les migrations qui servent plusieurs écrans : les éclater
obligerait à migrer trois fois la même table.

Chaque section renvoie aux maquettes par leur ancre : ouvrez `maquettes/refonte.html` et
ajoutez `#écran/état` à l'URL (`#objectif/b`, `#rituel/3`…). Les annotations au-dessus de
chaque maquette expliquent le *pourquoi* ; ce document dit le *comment*.

## Ordre de développement

| Lot | Section | Migrations | Front |
|---|---|---|---|
| 0 | Conventions et amendement | — | — |
| 1 | **Socle base de données** | 3 blocs | types + hooks partagés |
| 2 | Onboarding | — | ✓ |
| 3 | Dashboard | — | ✓ |
| 4 | Objectifs | — | ✓ |
| 5 | Tâches | — | ✓ |
| 6 | Année | — | ✓ |
| 7 | Rituel hebdomadaire | — | ✓ |
| 8 | Bilan trimestriel **et annuel** | `achieved` au trimestre | ✓ |
| 9 | Retour après absence | `last_seen_on`, `touch_last_seen()` | ✓ |

Les lots 2 à 4 valident le socle : l'onboarding crée les trois types d'objectif, la page
Objectifs les affiche, le dashboard les résume. Développer dans cet ordre expose une erreur de
schéma tôt, sur le plus petit écran du dépôt.

---

# §0 — Conventions

## 0.1 Amendement de SPEC-CLARITY-BACKEND.md

Trois décisions de la spec initiale sont **renversées** par la refonte. Elles doivent être
amendées dans `SPEC-CLARITY-BACKEND.md` avant la première migration, sinon le dépôt porte deux
documents qui se contredisent.

| Spec initiale | Devient |
|---|---|
| §1 — « aucun score calculé par l'app (ni %, ni streak, ni barre de complétion) » | L'app calcule une **régularité** et une **progression**. Le verdict humain (`review_item`) reste, il ne disparaît pas : il tranche là où le chiffre ne peut pas. |
| §6 — « Progression (%) d'un objectif — fausse mesure » | Réintroduite, mais **bornée par type** : une progression n'existe que si l'objectif porte une cible. Une habitude sans cible totale n'en a pas. |
| §6 — « Streak — pénalisait par construction les cadences non quotidiennes » | Remplacé par la **régularité glissante** sur 4 périodes closes, plafonnée à 100 % par période. Rater une période coûte 25 points et se répare seul quatre périodes plus tard. |
| §6 — « Objectif quantifié — le produit mesure la régularité, pas des quantités » | Réintroduit comme **type de mesure** à part entière. |

À noter : le streak existait déjà, caché. `ObjectiveHeatmap` colore ses colonnes selon une
série de semaines tenues remise à zéro dès qu'une semaine passée échoue (`run` dans
`src/components/objectives/ObjectiveHeatmap.tsx`). L'amendement rend explicite ce qui était
implicite — et le remplace par une mesure qui ne remet rien à zéro.

Les principes §1 qui **ne bougent pas** : aucun report automatique, et « deux tempos jamais
mélangés » — la refonte le renforce même, puisque la cadence devient une propriété de
l'objectif.

## 0.2 Ajouter une colonne à une vue chiffrée

Le piège central de ce chantier. `create or replace function` **ne peut pas** changer un
`returns table`, donc on ne peut pas simplement étendre une vue déchiffrante. La séquence
complète, à respecter dans cet ordre :

```
1. alter table private.X add column …            -- ou … _enc bytea si chiffré
2. drop view public.X;                           -- détruit aussi le trigger INSTEAD OF
3. drop function public.X_rows();
4. create function public.X_rows() …             -- signature étendue
5. revoke all on function public.X_rows() from public, anon;
   grant execute on function public.X_rows() to authenticated;
6. create view public.X as select * from public.X_rows();
7. revoke all on public.X from anon, authenticated;
   grant select, insert, update, delete on public.X to authenticated;
8. create or replace function private.X_view_iiud() …   -- + la colonne dans INSERT et UPDATE
9. create trigger X_iiud instead of insert or update or delete
     on public.X for each row execute function private.X_view_iiud();
```

Oublier **7** rend la vue inaccessible, oublier **9** la rend silencieusement en lecture seule.

## 0.3 La fonction à recopier n'est pas dans sa migration d'origine

Le dépôt réécrit les fonctions entières plutôt que de les patcher. Conséquence : la version qui
fait foi n'est pas celle du fichier où l'objet a été créé.

| Fonction | Version courante |
|---|---|
| `private.objective_view_iiud()` | `20260813203533_closed_at_server.sql` — **pas** 0006 |
| `private.task_view_iiud()` | `20260813200002_completed_at_server.sql` — **pas** 0004 |
| `public.objective_rows()` | `20260813153010_0007_forks.sql` — **pas** 0006 |
| trigger de validation de review | `20260814075453_review_openings.sql` — **pas** 0009 |

`objective_rows()` porte dans son `WHERE` une **troisième branche pour les forks** ajoutée en
0007. Toute réécriture doit la conserver, même si les espaces sont hors périmètre.

## 0.4 Les colonnes de tâche sont recopiées à la main

`private.on_task_change()` (migration 0008) crée l'occurrence récurrente suivante par un
`insert` qui **énumère les colonnes**. Toute colonne ajoutée à `private.task` demande une
décision explicite : propagée à l'occurrence suivante, ou volontairement perdue. Le §5 avait
tranché ainsi pour `planned_week` ; la colonne a depuis été retirée, mais la règle reste vraie
pour la prochaine.

## 0.5 Les contraintes en `CASE` ne se complètent pas

`objective_cadence_shape` est un `case … else cadence is null end`. Sa branche `else` capture
tout ce qui n'est pas explicitement listé : ajouter une valeur de `kind` ou de `measure` la
casse en silence — la nouvelle valeur tombe dans `else` et se voit interdire la cadence. Ces
contraintes se **réécrivent**, elles ne se complètent pas.

## 0.6 Filet de test

Le dépôt n'a **aucun test front** : ni vitest, ni testing-library, ni configuration. Le seul
filet est `npm run typecheck` + `npm run lint`, plus trois scripts SQL joués à la main.

Une refonte de cette ampleur sans filet est le principal risque du chantier. La mesure la moins
coûteuse, à poser en lot 0 : **vitest sur les seuls modules purs qui portent des règles** —
`appDate`, `recurrence`, `queryError`, `errorMessage`, `objectiveDisplay.computeTrend`,
`reviewPeriod.objectivesForPeriod`, `taskSort`, `taskScope`. Aucune I/O, aucun DOM, et ce sont
exactement les endroits où une régression passerait inaperçue.

Les tests SQL existants n'utilisent pas de framework : `begin` / bloc `do $$ … $$` /
`rollback`, avec `if <attendu> then raise notice 'OK: …' else raise exception 'FAIL: …' end if`.
Suivre ce style pour les tests ajoutés.

## 0.7 Règles de code inchangées

Tout `AGENTS.md` reste en vigueur. Les points que cette refonte sollicite le plus :

- **Tranches verticales** — un écran = une feature ; une feature n'importe jamais d'une autre.
  Ce qui est partagé remonte dans `src/lib/`, `src/hooks/` ou `src/components/`.
- **Un composant partagé ne consomme jamais le contexte d'une feature** : il reçoit en props.
- **TanStack Query exclusivement**, keys par la fabrique `src/lib/queryKeys.ts`, écritures sur
  les vues par `updateView` / `insertView` / `deleteView`.
- **Pas d'embedding PostgREST** sur les vues : charger séparément, joindre en mémoire.
- **`dataErrorMessage()`** pour tout message d'erreur ; toute nouvelle règle serveur ajoute sa
  copie française dans `BUSINESS_RULES` (`src/lib/errorMessage.ts`), sinon l'utilisateur lit
  « une erreur est survenue de notre côté ».
- **Aucune date du navigateur** : `useAppToday()` et l'arithmétique de `src/lib/appDate.ts`.
- **Tailwind d'abord**, tokens du `@theme` de `src/index.css`, `cn()` pour composer.

## 0.8 Garde-fous

Rien ne se joue sur le hosted. `npx supabase start`, `npx supabase db reset` à volonté,
`npm run db:types:local` après chaque migration. `npm run db:push:dry` avant tout push, et le
push lui-même est déclenché par l'utilisateur seul.

---

# §1 — Socle base de données

Le seul lot purement migrations. Trois blocs indépendants, jouables dans l'ordre. Aucun écran
n'en dépend visuellement : à la fin, l'app doit fonctionner exactement comme avant, avec un
schéma plus large.

## 1.1 Fenêtre annuelle ou trimestrielle, capacité simultanée

### Le problème

`private.objective` porte `year int` : la fenêtre d'un objectif est l'année entière. Les slots
sont uniques par `(propriétaire, year, kind, slot)`, donc trois principaux **par an**.

La refonte veut trois principaux **simultanés** : un objectif trimestriel libère sa place au
trimestre suivant, jusqu'à douze dans l'année.

### Colonnes

| Colonne | Type | Rôle |
|---|---|---|
| `quarter` | `smallint null check (quarter between 1 and 4)` | `null` = objectif annuel |
| `window_range` | `daterange generated always as (…) stored` | dérivée de `(year, quarter)` |

`window_range` se calcule uniquement avec `make_date`, immutable : la colonne générée est
légale. Convention de bornes : `[début, fin)` — un objectif T1 va du 1<sup>er</sup> janvier
inclus au 1<sup>er</sup> avril exclu, un annuel du 1<sup>er</sup> janvier au 1<sup>er</sup>
janvier suivant.

### Contraintes

`extensions.btree_gist` est requis (`create extension if not exists`).

Les deux index uniques partiels `objective_slot_user_uniq` / `objective_slot_space_uniq` sont
**remplacés** par deux contraintes d'exclusion :

```
exclude using gist (
  user_id with =, kind with =, slot with =, window_range with &&
) where (user_id is not null and slot is not null)
```

et son symétrique sur `space_id`. Lecture : *deux objectifs du même propriétaire, de même
nature, ne peuvent pas occuper le même slot sur des fenêtres qui se chevauchent.*

C'est la formulation déclarative exacte de la règle produit. Elle remplace un invariant qui
aurait dû sinon vivre dans un trigger, et elle est vérifiée par le moteur à chaque écriture.

### Trigger

`private.objective_view_iiud()` (version de `closed_at_server.sql`, cf. §0.3) : le bloc
d'attribution du plus petit slot libre cherche aujourd'hui sur `o.year = new.year`. Il doit
chercher sur **le chevauchement de fenêtre** :

```
where s not in (
  select o.slot from private.objective o
  where o.kind = new.kind and o.slot is not null
    and o.window_range && <window_range de new>
    and (o.user_id is not distinct from new.user_id)
    and (o.space_id is not distinct from new.space_id)
)
```

Le verrou consultatif reste, mais sa clé doit couvrir la fenêtre et non plus l'année seule.

La vue et son trigger sont à recréer (§0.2) : `quarter` et `window_range` entrent dans
`objective_rows()`. `quarter` est écrit à la création et **immuable ensuite**, comme `year`,
`kind` et `slot` — à ajouter à la liste de `objective_identity_immutable`.

### Conséquences à retenir

**Clôturer ne libère toujours pas le slot.** C'est la fin de la fenêtre qui le libère. Un
objectif annuel atteint en juin garde sa place jusqu'au 31 décembre — règle inchangée depuis la
spec initiale, simplement exprimée autrement.

**Deux objectifs simultanés ne peuvent plus partager un slot, donc plus jamais la même
couleur.** L'identité visuelle vient du slot (`src/lib/objectivePalette.ts`, trois skins) : la
contrainte garantit mécaniquement qu'on ne verra jamais deux cartes bleues côte à côte. La
frise de la maquette contient d'ailleurs un cas invalide — « Apprendre le piano » en slot 1
pendant que « Courir 100 fois » y est déjà. La contrainte l'aurait refusé ; c'est le bon
arbitre.

### Tests SQL

`supabase/tests/02_regles_metier.sql` section 2 (slots) est à réécrire : l'attribution
séquentielle, le `slot_full`, et surtout les deux cas neufs — deux objectifs T1 et T3 partagent
le slot 1 (accepté), un annuel et un T2 ne le peuvent pas (rejeté par l'exclusion).

## 1.2 Type de mesure et objectifs quantifiés

### Colonnes sur `private.objective`

| Colonne | Type | Rôle |
|---|---|---|
| `measure` | `text not null check in ('habitude','quantite','jalons')` | le type de mesure |
| `period_unit` | `text null check in ('week','month')` | unité de cadence (habitude) ou de relevé (quantité) ; `null` pour jalons |
| `target_value` | `numeric null` | cible ; facultative sur habitude, obligatoire sur quantité |
| `unit` | `text null` | libellé d'affichage ; `null` = sans unité |
| `entry_mode` | `text null check in ('cumul','releve')` | quantité seulement |
| `direction` | `text null check in ('atteindre','sous') default 'atteindre'` | quantité seulement |

`cadence` conserve son sens — le nombre attendu **par période** — mais n'est plus borné à 7 :
`check (cadence between 1 and 31)`, la borne réelle étant portée par la contrainte de forme
ci-dessous (7 max si `period_unit = 'week'`).

**`target_value` et `unit` sont en clair**, contrairement aux titres. Décision assumée : elles
ne sont pas indexables ni agrégeables si elles sont chiffrées, et le coût d'une RPC de
déchiffrement pour chaque somme ne se justifie pas ici. Si le modèle de menace évolue, la
bascule en `_enc` suit exactement la procédure §0.2.

**`unit` est un libellé d'affichage, pas une mesure.** Le select du front propose douze
entrées (`Sans unité` en tête, puis `€ $ kg lb km mi pas h min fois`, puis `Autre…`). On
n'ouvre pas une taxonomie du décompte — pas de « pages », « livres », « mots » : ces cas
prennent « sans unité ». La valeur reste un `numeric` nu ; jamais `"3 850 €"` en base.

### Contraintes

**`objective_cadence_shape` est à réécrire** (§0.5), pilotée par `measure` et non plus par
`kind` :

```
case
  when parent_objective_id is not null then cadence is not null   -- fork, inchangé
  when measure = 'habitude'            then cadence is not null
  else                                      cadence is null
end
```

**Nouvelle contrainte `objective_measure_kind`** : un `secondaire` ne peut pas être une
`habitude`. C'est la définition même du secondaire — un objectif sans demande hebdomadaire.
La base l'interdisait déjà indirectement (pas de cadence sur un secondaire) ; la contrainte le
dit maintenant explicitement, au bon endroit.

**Nouvelle contrainte `objective_measure_shape`**, par mesure :

| `measure` | `cadence` | `period_unit` | `target_value` | `entry_mode` |
|---|---|---|---|---|
| `habitude` | requis, ≤ 7 si `week` | requis | facultatif | `null` |
| `quantite` | `null` (implicitement 1 par période) | requis | **requis** | requis |
| `jalons` | `null` | `null` | `null` | `null` |

### Backfill

Les objectifs existants : `cadence is not null` → `'habitude'` avec `period_unit = 'week'` ;
tous les autres → `'jalons'`. À jouer **avant** de poser `not null` sur `measure`.

### Table `public.objective_entry`

Les saisies d'un objectif quantifié. En clair, donc gabarit `public.review` (table dans
`public`, RLS avec policies) et non gabarit `private.review_item`.

| Colonne | Type |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `objective_id` | `uuid not null references private.objective (id) on delete cascade` |
| `entry_date` | `date not null` |
| `value` | `numeric not null` |
| `created_by` | `uuid not null default auth.uid() references public.profile (id)` |
| `created_at` | `timestamptz not null default now()` |

Policies `select` / `insert` / `update` / `delete` adossées à
`public.is_objective_visible(objective_id)`. Index sur `(objective_id, entry_date desc)`.

`entry_date` est posée par le serveur au jour applicatif à l'insertion — le client ne l'envoie
pas, même règle que `completed_at` et `closed_at`. Saisir un relevé antidaté n'est pas un
besoin du produit.

### RPC

```
public.objective_progress(p_objectives uuid[])
  returns table (objective_id uuid, value numeric, entries int, last_entry_date date)
```

`value` = somme des saisies en mode `cumul`, dernière saisie en mode `releve`. Un mode
`releve` peut baisser (un solde bancaire baisse) : c'est voulu, la fonction ne borne rien.

## 1.3 Périodes et régularité

### Généralisation de `objective_week`

La table ne sait compter que des semaines. Une habitude mensuelle et un relevé mensuel ont
besoin de la même mécanique sur une autre unité.

```
objective_week            →  objective_period
  iso_year                →    period_year
  iso_week                →    period_index
  cadence_target          →    target
  active_days             →    done
                          +    period_unit text not null check in ('week','month')
```

Nouvelle clé primaire `(objective_id, period_unit, period_year, period_index)`. Le renommage
préserve données, policy et grants. `period_unit` s'ajoute avec `default 'week'`, puis le
default se retire une fois la table remplie.

**Sémantique de `target`, par mesure :**

| `measure` | `target` | `done` |
|---|---|---|
| `habitude` | `cadence` de l'objectif, figée à la première activité de la période | jours crédités distincts |
| `quantite` | `1` — une saisie attendue par période | `0` ou `1` |
| `jalons` | *aucune ligne* | — |

Une seule table pour toute la régularité, quel que soit le type. C'est ce qui permet à la RPC
ci-dessous de n'avoir qu'un seul chemin.

### Fonctions à réécrire

| Fonction | Modification |
|---|---|
| `private.refresh_objective_week` → `refresh_objective_period` | prend l'unité de l'objectif, calcule `period_year`/`period_index` selon `week` ou `month`, alimente aussi les objectifs quantifiés depuis `objective_entry` |
| `private.on_task_change` | appelle la nouvelle fonction |
| `private.backfill_objective_weeks` → `backfill_objective_periods` | `generate_series` par unité |
| `cron.schedule` | un job par unité — hebdomadaire lundi 00:15 UTC (inchangé), mensuel le 1<sup>er</sup> 00:15 UTC |
| `public.space_objective_weekly_state` | ses paramètres se nomment `p_iso_year` / `p_iso_week` et son `join` porte sur les anciennes colonnes : à traverser même si les espaces sont hors périmètre |

**Nouveau trigger** sur `public.objective_entry` (AFTER insert/update/delete) → rafraîchit la
période concernée. Symétrique de `task_after_change`.

`private.credit_day` ne bouge pas : elle rend un jour, l'agrégation en période se fait
au-dessus. `public.objective_active_days` ne bouge pas non plus.

### RPC de régularité

```
public.objective_regularity(p_objectives uuid[])
  returns table (
    objective_id      uuid,
    done              int,   -- 4 dernières périodes CLOSES, done plafonné à target par période
    target            int,
    done_projected    int,   -- les mêmes, période en cours incluse
    target_projected  int
  )
```

**Définition, à respecter à la lettre :** sur les 4 dernières périodes closes, la part de
l'attendu qui a été fait, **chaque période plafonnée à 100 %**. Une semaine à 5 séances sur 3
ne rachète pas une semaine à 0 — on mesure un rythme, pas un volume.

Les deux jeux de valeurs viennent du même appel parce que le rituel affiche les deux : au
dimanche soir, la semaine en cours n'est pas encore close, et l'écran de projection annonce
« 75 % → 83 % ». Sans les valeurs projetées, le front devrait recalculer — donc dupliquer la
règle.

**Une période close** est une période strictement antérieure à la période courante. Le chiffre
ne change donc qu'au passage à la période suivante, jamais pendant qu'on la vit. C'est la
propriété qui rend la mesure supportable, et elle est gratuite : c'est un prédicat, pas une
action de clôture.

### Front du socle

`npm run db:types:local`, puis les hooks de lecture partagés. Aucun écran.

| Hook | Remplace / ajoute |
|---|---|
| `useObjectives` | tri par **début de fenêtre puis slot** (aujourd'hui slot seul) ; expose `measure`, `quarter`, `window_range` |
| `useObjectivePeriods` | remplace `useObjectiveWeeks` — `indexPeriods()` doit clé sur `objectifId\|unit\|year\|index`, l'index actuel sur le seul numéro de semaine est ambigu quand une grille enjambe deux années ISO |
| `useObjectiveRegularity` | RPC `objective_regularity` |
| `useObjectiveEntries` | lecture de `objective_entry` |
| `useObjectiveProgress` | RPC `objective_progress` |

Keys correspondantes à ajouter dans `src/lib/queryKeys.ts` — jamais de key littérale.
`objectiveWeek` devient `objectivePeriod`. `viewWrites.ts` : `objective_entry` rejoint
`WritableView`.

### Tests SQL

- `02_regles_metier.sql` §3 (cadence) → réécrite autour de `measure` et de la forme par type.
- `02_regles_metier.sql` §7 et §11 (`objective_week`, backfill) → `objective_period`, avec un
  cas mensuel.
- `03_dashboard_reads.sql` → la concordance stricte entre `objective_active_days()` et la somme
  des périodes doit tenir pour les deux unités.
- Nouveau : la régularité plafonnée (une période à 5/3 compte 3/3) et l'exclusion de la période
  courante.

---

# §2 — Onboarding · `#onboarding/s1…s6`

**Aucune migration.** Premier écran à développer : `features/onboarding/` fait 190 lignes,
c'est le plus petit du dépôt, et il crée les trois types d'objectif — donc il valide le socle.

## Le parcours

Quatre questions, jamais un choix de « mode ». L'app ne se configure pas, elle fait créer un
premier objectif correctement typé.

| Écran | Question | Écrit |
|---|---|---|
| `s1` | Qu'est-ce que vous voulez accomplir ? | `title` |
| `s2` | D'ici quand ? | `year`, `quarter` |
| `s3` | Comment saurez-vous que c'est fait ? | `measure` |
| `s4a/b/c` | Le paramétrage — **trois formes** | selon `measure` |
| `s5` | Vos trois slots | rien |
| `s6` | Prêt | `profile.onboarded_at` |

**L'étape 3 ne nomme jamais la typologie.** Les trois réponses sont formulées en langage
naturel (« je l'aurai fait un certain nombre de fois » / « j'aurai atteint un montant » /
« j'aurai franchi ces étapes ») : l'utilisateur répond à une question sur sa vie, pas sur le
modèle de données.

**Pour un objectif secondaire, la première réponse disparaît** — un secondaire n'a pas de
cadence, donc pas d'habitude. La contrainte se dit dans la question au lieu d'arriver en
erreur `objective_measure_kind` après coup.

## Les trois formes de l'étape 4

| Forme | Champs |
|---|---|
| `s4a` habitude | cadence (1–7) × unité (semaine / mois) · cible totale **facultative** en séances |
| `s4b` quantité | cible + unité · mode de saisie (relevé / cumul) · point de départ · fréquence des relevés |
| `s4c` jalons | la liste des étapes · **aucune cadence demandée**, l'écran le dit |

**Contrôle de faisabilité** commun aux trois, dans un encart en bas : « il reste 20 semaines,
à 3 séances par semaine vous arriverez à 60 », « il vous manque 2 150 € et il reste 5 relevés,
soit 430 € par mois ». C'est le seul moment où une cible irréaliste peut encore être corrigée.

**Le mode de saisie est le réglage qui compte** sur `s4b`. Un **relevé** remplace la valeur
précédente et peut baisser (le solde d'un compte, un poids) ; un **cumul** s'additionne (des
livres, des kilomètres). Forcer une épargne en cumul obligerait à faire la soustraction de tête
chaque mois — et les gens arrêteraient de saisir.

**La cible totale d'une habitude n'a pas de select d'unité** : une habitude se compte en
séances, c'est l'application qui compte. Le select n'apparaît que sur la quantité.

## Le select d'unité

Douze entrées, plates (pas d'`optgroup` à cette échelle) :
`Sans unité · € · $ · kg · lb · km · mi · pas · h · min · fois · Autre…`

`Sans unité` en tête, c'est le défaut d'un nouvel objectif. `Autre…` révèle un champ libre.
L'unité choisie se répète en **suffixe fixe** dans « Où en êtes-vous » et dans le relevé du
rituel : elle n'est jamais retapée.

## Écran des slots

Après création du premier objectif, `s5` montre les trois places : une prise, deux ouvertes,
aucune exigée. **Trois est un plafond, pas un quota.** Demander trois objectifs annuels dans
les deux premières minutes produit un vrai objectif et deux remplissages — et les remplissages
sont le pire résultat possible : ils diluent la contrainte, n'avancent jamais, et leurs lignes
vides redeviennent la culpabilité que la refonte enlève.

## Fichiers

`src/features/onboarding/` — `OnboardingCoach.tsx`, `onboardingSteps.ts`,
`useCompleteOnboarding.ts`. Le parcours de création partage sa logique avec
`ObjectiveFormModal` (§4) : extraire un `objectiveDraft.ts` dans `features/objectives/` plutôt
que dupliquer la validation par type.

---

# §3 — Dashboard · `#dashboard/a, b, b2, c`

**Aucune migration.**

## Composition

Trois blocs, dans cet ordre :

1. **Encart du rituel** — fond `bg-night`, méta dense, bouton bleu. Reprend l'encart de review
   existant. Un dégradé bleu pleine largeur dépenserait la couleur d'action en décoration, ce
   que `DESIGN.md` interdit.
2. **Vos objectifs** — cartes **pleines en desktop** (grille de 3), **compactes en mobile**
   (une par ligne). À trois par ligne sur 390 px le titre tombe à « M… ».
3. **Aujourd'hui** — les tâches du jour, sous-section qui **a le droit d'être vide**.

**Le bandeau « semaine » de la maquette initiale a été supprimé** : il listait les trois mêmes
objectifs avec le même état hebdomadaire juste sous les cartes. L'anneau porte déjà « 2 sur 3
cette semaine » ; le détail jour par jour vit sur la page de l'objectif et à l'étape 2 du
rituel, là où on peut le corriger.

## La carte qui reprend vie

Mécanisme conservé (`cardPop` + `colorReveal`, déjà dans `src/index.css`). Deux garde-fous
pour qu'elle reste une récompense et pas un reproche :

- **Seuls les objectifs à cadence se désaturent.** Une quantité ou des jalons n'ont pas de
  rythme quotidien ; les désaturer serait un jugement sans objet.
- **Une semaine déjà complète reste allumée.** Désaturer une semaine parfaite parce qu'on n'a
  rien fait un dimanche serait exactement le jugement quotidien que la refonte enlève.

Condition : `dim = mesure === 'habitude' && semaine incomplète && rien fait aujourd'hui`.

## États

| État | Contenu |
|---|---|
| `a` semaine normale | les trois blocs, une carte désaturée |
| `b` premier jour | trois slots vides — les invitations **sont** le contenu de l'écran |
| `b2` un objectif sur trois | l'invitation se réduit à une affordance discrète |
| `c` rien dû aujourd'hui | phrase calme, pas d'état vide à bordure pointillée |

**L'invitation décroît à mesure que les slots se remplissent.** Deux grandes cartes pointillées
à côté d'un seul objectif transforment « trois maximum » en « il vous en manque deux ».

Les états vides ne portent **jamais** de bordure pointillée ni de grande icône bleue quand un
contenu existe déjà ailleurs : ces signaux se lisent comme un manque à combler.

## Fichiers

`src/features/home/DashboardView.tsx` fait 392 lignes et cumule toolbar, layout, fetching et
états d'erreur. À découper : un composant par bloc, le fetching remonté dans la page.
`TaskRow`, `QuarterActivity`, `dashboardPrefs` et le trio de contexte survivent tels quels.

`objCard` gagne une variante compacte **sur une ligne** (~70 px) : titre et sous-titre à
gauche, la valeur à droite — anneau pour une habitude, montant pour une quantité, `2 / 4` pour
des jalons. La variante actuelle réutilise la mise en page verticale de la carte pleine avec
moins de contenu : 100 px pour la moitié de l'information.

---

# §4 — Objectifs · `#objectif/a…e`

**Aucune migration.**

## Le principe : une bande, une question

| Bande | Question | Contenu |
|---|---|---|
| En-tête | de quoi s'agit-il | pastille, titre, **une** ligne de méta, actions dans un menu `⋯` |
| Héros | où j'en suis | un seul grand chiffre, sa barre, la projection en une ligne |
| Bloc sombre | est-ce que je tiens le rythme | deux chiffres et **le** graphique |
| Suite | la matière | jalons, tâches reliées |

**Aucune explication de mécanique dans l'écran.** La version précédente portait trois
paragraphes — le fonctionnement de la régularité, la légende de la heatmap, « une colonne
encadrée est une semaine tenue ». Personne ne les lit, et ils noient le chiffre. Les nuances
visuelles restent (attendu-pas-fait ≠ pas-de-donnée), elles n'ont pas besoin d'être commentées.

## Par type

| État | Héros | Bloc sombre |
|---|---|---|
| `a` habitude | `62 sur 100 séances`, projection | régularité + heatmap **bornée au trimestre** |
| `b` quantité | `4 400 € sur 6 000 €`, projection, bouton de saisie | moyenne + relevés saisis + courbe **avec ses points** |
| `c` jalons | `2 sur 4 étapes`, semaines restantes | **aucun** |
| `e` secondaire | valeur, « revu au bilan de T3 » | courbe + nombre de saisies, **pas de régularité** |
| `d` arrêté | valeur seule, ni barre ni projection | heatmap tronquée à la date d'arrêt |

**Le type jalons n'a pas de bloc sombre du tout.** Un objectif par étapes n'a pas de rythme :
l'absence du bloc énonce la règle mieux qu'un paragraphe qui l'explique.

**Un seul graphique par objectif.** La version précédente affichait pour la quantité une courbe
cumulée *et* des barres mensuelles — les deux répondaient aux deux chiffres déjà écrits
au-dessus. Il reste la courbe, avec ses **points de relevé visibles** : un écart entre deux
points, c'est une période sans saisie. Le montant et le rythme dans la même figure.

## La heatmap

`src/components/objectives/ObjectiveHeatmap.tsx` demande trois corrections.

**La rampe encode un streak.** `run` s'incrémente à chaque semaine tenue et **retombe à zéro**
dès qu'une semaine passée échoue — c'est exactement le streak que le §0.1 supprime. Elle doit
encoder l'intensité de la période : plus la case est pleine, plus il y a eu de séances.

**Elle déborde.** 52 semaines à 27 px ne tiennent nulle part. Deux mesures : la borner à la
fenêtre affichée (13 semaines sur la page objectif, l'année se consulte sur l'écran Année) et
rendre la taille de case paramétrable. Les constantes de géométrie (`CELL`, `COL_STEP`) sont
aujourd'hui dupliquées entre le JS et des classes Tailwind arbitraires : les dériver d'une
seule source.

**Ses couleurs sont en dur** (`#1b1c24`, `#34364a`, `#20212c`, `#262734`, `#565866`), hors
tokens. À remonter dans le `@theme`.

`computeTrend` et `TrendBadge` (`objectiveDisplay.ts`) cèdent la place à la régularité : ils
calculaient une tendance sur trois semaines révolues, que la RPC couvre mieux.

## Le rail et la sélection

Trois sections : `Principaux · n sur 3`, `Secondaires · n sur 5`, `Arrêtés`. Les secondaires
ont des lignes plus fines et **le gris partagé** de `ObjectivePicker` aujourd'hui — pas de
couleur de slot. On ne retient pas leur identité parce qu'on n'est pas censé les surveiller.

**En mobile, des pastilles horizontales** remplacent le select : on voit tous les objectifs et
leur couleur, et changer coûte un geste au lieu de deux.

## Le secondaire

Un secondaire est un objectif **sans cadence** : seuls `quantite` et `jalons` lui sont ouverts
(contrainte `objective_measure_kind`, §1.2). Tout en découle :

- absent du dashboard, du bandeau de la semaine et du rituel ;
- **pas de régularité** — elle mesure « tenu sur attendu », et rien n'est attendu. Ce n'est pas
  une exception, c'est une conséquence des deux types autorisés ;
- on n'en reparle qu'au **bilan du trimestre** (§8).

## Fichiers

`ObjectiveDetail.tsx` reçoit **17 props** : signe qu'il ne compose pas, il reçoit tout
prémâché. `ObjectivesPage.tsx` fait 351 lignes d'orchestration. Les deux sont à découper autour
des quatre bandes, pas à patcher. `CadenceStrip`, `YearProgressBar` et `MilestoneList`
survivent moyennant l'adaptation aux périodes.

---

# §5 — Tâches · `#taches/a, b`

## ~~Migration — `planned_week`~~ · **abandonnée**

> **Amendement.** Cette section prévoyait une colonne `task.planned_week` — l'intention de la
> semaine, distincte de l'échéance — écrite par l'écran « la semaine qui vient » du rituel (§7).
> Elle a été implémentée, puis **retirée avec cet écran** : à l'usage, redésigner chaque dimanche
> les tâches de la semaine à venir n'apportait rien. Remettre simplement le pool sous les yeux à
> l'écran de tri suffit, et les deux écrans finissaient par poser la même question deux fois.
>
> La colonne n'ayant jamais eu d'autre auteur que cet écran, elle est partie avec lui : sa
> migration a été supprimée avant tout push, le schéma de `private.task` est donc resté celui de
> `completed_at_server.sql`. **Rien à annuler côté hosted.**
>
> Le raisonnement reste valable si le besoin revient : une échéance est un fait sur le monde — le
> dentiste est le 12, ça peut être en retard — une intention est un fait sur soi, et ça ne peut
> pas être en retard. Dater au lundi recréerait la promesse au futur soi que la refonte enlève.
> Il faudrait donc bien une colonne à part, et non un `due_date` détourné.

Le reste du §5 ci-dessous **ne dépendait pas de la colonne** et reste en vigueur.

## Front

**Vue « Sans date »** dans les vues de `taskViewParams` / `taskScope`, aux côtés d'Aujourd'hui,
Cette semaine, En retard, Toutes.

**Capture en une ligne** : un champ, `↵` pour valider, ni objectif ni date obligatoires. C'est
le comportement observé chez les testeurs — bloc-notes, sans jour, coché après coup.

**Une tâche non datée crédite le jour où on la coche.** `private.credit_day` le fait déjà :
`least(coalesce(due_date, jour de complétion), jour de complétion)` — sans échéance, c'est le
jour de la complétion qui compte. Conséquence majeure : **la progression fonctionne sans
planification**. Quelqu'un qui n'ouvre l'app que le jeudi et coche quatre
choses voit ses objectifs avancer correctement.

**Âge des éléments** en méta discrète (« depuis 6 semaines »), sans rouge — c'est une
information, pas un reproche. Le tri se fait au rituel.

**Une tâche sans objectif est autorisée** et ne compte pas dans la progression. « Appeler le
dentiste » existe ; l'interdire enverrait les gens ailleurs, la faire compter en douce
polluerait la mesure.

**Bande compacte d'objectifs en tête, desktop seulement** — comme aujourd'hui dans
`TasksView`. Sur 390 px elle mangerait l'écran avant la première tâche.

## Tests SQL

Aucun — la seule section qu'appelait ce lot couvrait `planned_week`, retirée avec l'écran qui
l'écrivait (voir l'amendement ci-dessus).

---

# §6 — Année · `#annee/a, b, c`

**Aucune migration.** Lecture pure des données existantes.

## Le rôle de l'année

L'année n'est plus la *durée* d'un objectif, c'est le **récit** de l'année : une frise où
chaque objectif est un segment, à sa place et à sa longueur. Un objectif de trois mois n'y est
pas un trou, c'est une séquence terminée. C'est ce qui donne une raison d'ouvrir la vue
annuelle en février.

## Deux pages, pas une

**Amendement.** La première version tenait en un seul écran : la frise annuelle, puis des
onglets T1–T4 qui dépliaient le détail du trimestre en dessous. À l'usage les deux niveaux se
disputaient la même page — trois bandes pleine largeur du même poids, et le même objectif
nommé jusqu'à trois fois. L'année et le trimestre vivent désormais sur **deux pages** :

| Route | Rôle |
|---|---|
| `/annee` · `/annee/:year` | le **récit** : bandeau, frise annuelle, et les quatre trimestres en portes d'entrée |
| `/annee/:year/t:quarter` | le **détail** d'un trimestre |

L'année est dans l'URL des deux côtés — c'est ce qui permet au fil d'Ariane du trimestre de
revenir sur la bonne année, et à `/annee/2025/t2` de se mettre en favori. Une URL bricolée
(`t9`, une année non numérique) retombe sur `/annee`.

## Composition de la page Année

1. **Stepper d'année** `◀ 2026 ▶`, flèche droite bloquée sur l'année en cours. Un segmented
   control tient à deux ans, plus à dix. Il **navigue** (`/annee/2025`) au lieu de changer un
   state local.
2. **Bandeau annuel** — `2026 · SEMAINE 33` à gauche, **`62 %` de l'année** en gros à droite.
   Pas de barre de progression en plus : le trait orange de la frise marque déjà aujourd'hui.
   C'est la **seule surface sombre** de l'écran — partout ailleurs dans l'app il n'y a qu'un
   bloc `bg-night` par page.
3. **La frise** — un segment par objectif, avec sa densité hebdomadaire à l'intérieur. Un
   **voile** assombrit la portion à venir de chaque barre : sans lui, le futur se confond avec
   une période passée sans activité. Un objectif arrêté **s'interrompt à sa date d'arrêt**, le
   reste de sa fenêtre en pointillé, marqué « arrêté » et jamais « échoué ». Les secondaires
   ferment la frise, en rangs plus fins et atténués.
4. **Les quatre trimestres** — une ligne chacun, cliquable : bornes en toutes lettres
   (« juillet → septembre »), les pastilles des objectifs portés, leur nombre, et l'état du
   bilan. Un trimestre à venir ne montre **aucune pastille** : annoncer des objectifs « portés »
   sur une période pas encore vécue se contredit.

## Composition de la page Trimestre

1. **Fil d'Ariane** `‹ Année 2026`, et deux flèches `‹ ›` collées au titre pour glisser d'un
   trimestre au voisin sans remonter. Elles s'éteignent aux deux bouts de l'année.
2. **En-tête** — `T3 · juillet → septembre`, et à droite l'état du bilan avec son bouton :
   *Revoir* si validée, *Commencer* si ouverte, inerte avec sa date d'ouverture sinon. La règle
   d'ouverture est énoncée au lieu d'être découverte au clic, et le bouton désactivé n'est
   jamais un lien mort.
3. **Une ligne par objectif** — le titre et le chiffre au premier étage, la frise du trimestre
   et le détail au second. Le titre n'est écrit **qu'une fois**, et en entier. La colonne des
   chiffres est **figée** et non dimensionnée par son contenu : laissée en `auto` elle varie
   d'une ligne à l'autre, les frises finissent à des abscisses différentes, et deux rythmes ne
   se comparent plus. **Seuls les objectifs portés sur le trimestre** y figurent : une piste
   vide n'apprend rien et se lit comme un objectif délaissé.
4. **Les secondaires ont leur propre bande** et leur intertitre, plutôt qu'une opacité au
   milieu des autres : on comprend *pourquoi* ils sont atténués au lieu de le subir.
5. **La densité est sur fond clair** — piste `bg-field`, rempli en `skin.core` à opacité
   croissante, à venir en pointillé. L'opacité est plafonnée bien en dessous de 1 : une période
   mensuelle occupe un tiers de la piste, et à pleine saturation elle crie plus fort que le
   chiffre à côté. `skin.ramp` est calibrée pour le nuit, elle ne sert pas ici.
6. **Un trimestre pas encore commencé** n'affiche ni frise vide ni « 0 séance » — seulement
   une phrase calme, sans bordure pointillée.

## Mobile

La frise annuelle passe en **segments pleins sans détail hebdomadaire** : 52 semaines à 390 px
ne se lisent pas. Le détail se consulte trimestre par trimestre, où 13 semaines tiennent.

Sur la barre d'onglets mobile, **« Année » prend la place de « Review »** : la barre ne tient
que quatre entrées plus le bouton d'ajout, et le rituel s'ouvre de toute façon depuis son
encart sur le dashboard, alors que l'écran Année n'a pas d'autre porte. La sidebar desktop
porte les cinq entrées.

## Réutilisation

`quarterBounds`, `quarterAnchor`, `weeksOfQuarterRefs`, `yearProgressPercent` (`appDate.ts`),
`windowStart` / `windowEnd` (`objectiveFeasibility.ts`) pour les bornes de fenêtre,
`objectivesForPeriod` (`reviewPeriod.ts`) pour la règle de clôture, `heatLevel`
(`objectiveState.ts`) pour la densité, `public.review_openings()` et `useQuarterReviews` pour
l'état des bilans, `useObjectivePeriods` pour les relevés.

**Un piège de chargement** : `objective_period.period_year` vaut l'année **ISO** en
hebdomadaire et l'année **civile** en mensuel. Une année civile mord sur l'année ISO
précédente (la semaine du 1<sup>er</sup> janvier) comme sur la suivante (celle du 31 décembre) —
d'où jusqu'à trois appels hebdomadaires, dont les inutiles ne partent pas.

---

# §7 — Rituel hebdomadaire · `#rituel/1…5`

**Aucune migration** — `public.review` couvre déjà `period_type = 'week'`.

## Ce que le rituel remplace

C'est la **boucle principale du produit**, pas un accessoire. Le pain point d'origine était
que l'absence produit une dette : ne pas ouvrir coûte zéro sur le moment mais fabrique un trou
qui se lit comme un échec. Le rituel déplace **l'obligation du jour à la semaine** — un
rendez-vous tenu plutôt que sept ratés — tout en gardant le jour comme unité d'enregistrement.

## Les trois questions, puis ce que le rituel rend

| Deck | Rôle |
|---|---|
| 1 · le constat | un chiffre : « 7 choses faites cette semaine ». On mène avec ce qui a été fait |
| 2 · réparer | cocher un jour oublié, saisir le relevé, cocher une étape |
| 3 · trier | le pool — abandonner ce qui ne mérite plus d'exister |
| — · projection | ce que le rituel rend (hors décompte : ce n'est pas une question) |

> **Amendement.** Un quatrième écran, « emporter », demandait de désigner les tâches de la
> semaine à venir (`planned_week`, §5). Il a été implémenté puis **retiré** : redésigner chaque
> dimanche ce qu'on fera n'apportait rien, et il posait à l'utilisateur la même question que
> l'écran 3 à une minute d'intervalle — « garder » et « emporter » se lisant comme des synonymes.
> Le simple fait de remettre le pool sous les yeux à l'écran 3 suffit à rappeler qu'un backlog se
> remplit. Le §5 a perdu sa colonne du même coup.

**L'écran 2 est le cœur.** Le comportement bloc-notes observé chez les testeurs — « je coche
après coup, deux ou trois jours plus tard » — a enfin un endroit où exister au lieu d'être
subi. Les jours se touchent.

**Jeter est la valeur de l'écran 3, pas un aveu.** Sans ce moment, un backlog non daté devient
un cimetière de 200 lignes et la culpabilité revient par la fenêtre. L'écran ne propose donc
**qu'un geste : abandonner** — garder, c'est ne rien faire, et n'a pas besoin d'un bouton. La
première version en offrait trois (garder / reporter / abandonner) ; les deux premiers
n'écrivaient rien et ne se distinguaient que par leur effet sur l'écran « emporter », disparu.

**La projection est la contrepartie.** Sans elle, l'app ne fait que prendre. Elle transforme le
pointage en prévision, et le delta de régularité montre son arithmétique : la semaine 29 sort,
la semaine 33 entre.

## Garde-fous

- **Rien ne s'empile.** Sauter trois semaines ne produit pas trois rituels en attente.
- **Le rituel n'est jamais une porte.** Tout ce qu'il contient est faisable ailleurs, à tout
  moment. C'est un raccourci confortable, pas un passage obligé — et il reste ouvrable un
  mercredi.
- Une seule notification par semaine, celle-là.

## Front

`ReviewFlow` (303 lignes) est **déjà le bon pattern** : `steps` dérivé de la période,
`step`/`goalIndex` en state local, aucune lib de machine à états, aucune route. Il est
simplement inliné.

**Extraire une enveloppe `RitualOverlay`** dans `src/components/` : `role="dialog"`,
`aria-modal`, `z-60` (couvre la sidebar), fade in/out avec `CLOSE_MS = 430`, Escape,
`usePrefersReducedMotion`, pastilles de progression en pied. C'est le seul morceau réellement
partagé entre le rituel, le bilan et l'écran de retour.

À réutiliser tel quel : `ReviewFlowRecap` (entièrement paramétré par du texte),
`objectivesForPeriod` (`reviewPeriod.ts` — la règle de clôture n'existe qu'ici, pas en SQL),
`weeksOfQuarterRefs`, `quarterRatingKey`.

À corriger en passant : `ReviewFlowRating` reçoit **17 props** (fusionner
`cells`/`daily`/`stat`/`sparkline` en un objet « matière de la période ») et
`ReviewFlowBands` porte un `animationDelay: '1.9s'` en dur qui casse dès que le nombre
d'objectifs change.

**Le langage visuel est le deck sombre existant** : fond dégradé radial, contenu centré, une
idée par écran, sur-titre en capitales espacées, chiffre géant en dégradé bleu, un bouton
primaire à halo, `← Quitter` et les pastilles en pied. Presque pas de texte — les
justifications produit vivent dans ce document, pas dans l'interface.

---

# §8 — Bilan trimestriel · `#bilan/1, 2, 2b, 3, 4`

> **Amendement.** Ce document affirmait plus bas que « le bilan de T4 *est* celui de l'année »
> et décrivait un flux unique de cinq écrans. C'est **renversé** : le bilan de trimestre et le
> bilan de l'année sont **deux cérémonies distinctes**, comme
> [SPEC-CLARITY-BACKEND §4.4](./SPEC-CLARITY-BACKEND.md) le dit depuis le début (« le dernier
> vendredi de décembre en porte trois ») et comme `public.review_openings()` l'implémente déjà,
> en émettant une ligne `year` séparée des quatre lignes `quarter`.
>
> La raison est que les deux écrans ne posent pas la même question. Le trimestre **recompose**
> les trois places pour les trois mois qui viennent ; l'année **ferme** douze mois et ne
> recompose rien — la composition de janvier se décide au bilan de T4, pas au bilan annuel. Les
> enchaîner ferait porter à une seule assise deux horizons différents, et le quatrième deck
> (« le trimestre qui vient ») tomberait au milieu.
>
> Conséquences : le tableau des cinq écrans se lit comme **quatre decks** pour le trimestre
> (`#bilan/1, 2, 2b, 3`), l'écran `#bilan/4` devenant le **deck d'ouverture** d'un flux annuel
> autonome de trois écrans (récit · verdicts des principaux · verdicts des secondaires). Les deux
> cérémonies partagent leur coquille, leur table et leur adresse — `/bilan/:year/:period`, où
> `:period` vaut `t1`…`t4` ou `annee`.
>
> Le bilan annuel n'a **aucune migration** : au niveau `year`, la base n'accepte que `achieved`
> depuis 0009. Seul le trimestre change, ci-dessous.
>
> Enfin, l'enchaînement automatique depuis le rituel n'est **pas** implémenté : le bilan s'ouvre
> depuis son encart de dashboard ou depuis l'écran Année, où sa période est dans l'adresse.
> « Le rituel n'est jamais une porte » (§7) vaut aussi dans ce sens-là.

## Migration — `achieved` au trimestre

Le trigger `private.review_item_view_iiud()` (0009) n'autorise `achieved` **qu'au bilan
annuel** :

```
if r.period_type in ('week','quarter') then
  if new.achieved is not null then raise exception 'review_item_achieved_year_only'; end if;
else
  if new.rating is not null then raise exception 'review_item_rating_not_for_year'; end if;
end if;
```

Au trimestre il faut désormais les deux formes, selon la fenêtre de l'objectif noté :

| Niveau | Formes autorisées |
|---|---|
| `week` | `rating` seul |
| `quarter` | `rating` **ou** `achieved`, jamais les deux |
| `year` | `achieved` seul |

Nouvelle erreur `review_item_verdict_exclusive` et sa copie française dans `BUSINESS_RULES`
(`src/lib/errorMessage.ts`) : *« Un objectif se note, ou reçoit un verdict — pas les deux. »*

Le message `review_item_achieved_year_only` reste pour le niveau `week` ; sa copie doit être
reformulée (elle dit « ne se pose qu'au bilan annuel », ce qui devient faux).

## Pourquoi la cérémonie existe

Le rituel hebdo répond à « où j'en suis ». Le bilan trimestriel répond à **« est-ce que je
continue, et avec quoi »**. Deux choses lui donnent un rôle que rien d'autre ne peut tenir :

- **Un objectif trimestriel se termine** — le bilan est sa clôture, d'où `achieved` au
  trimestre.
- **Un slot se libère** — c'est le seul moment du produit où la composition des trois objectifs
  change délibérément au lieu de dériver.

## Les quatre écrans du trimestre

| Deck | Rôle |
|---|---|
| 1 · le trimestre | le fait brut : 13 semaines, séances, quantité, jalons |
| 2 · le verdict | **un objectif principal à la fois** — fusées 1–3 *ou* verdict, note libre 280 caractères, bande d'évolution |
| 3 · les secondaires (`#bilan/2b`) | **un seul écran pour tous**, une ligne chacun |
| 4 · le trimestre qui vient | la composition — l'acte qui justifie la cérémonie |

**La forme du jugement ne se choisit pas, elle se déduit** : un objectif dont la **fenêtre se
ferme** avec ce trimestre reçoit un verdict (`achieved`), celui qui continue reçoit une note
(`rating`). Un trimestriel de T3 se conclut au bilan de T3 ; un annuel ne se conclut qu'en T4.
La comparaison porte sur les **fins de fenêtre**, pas sur les numéros de trimestre — un objectif
de T2 encore ouvert au bilan de T3 se conclut lui aussi, sa fenêtre étant derrière nous.
`verdictExpected()` (`features/review/bilanContent.ts`) est le seul endroit où la règle vit.

## Les trois écrans de l'année (`#bilan/4`)

| Deck | Rôle |
|---|---|
| 1 · le récit | « 3 sur 4 objectifs menés au bout », jours actifs, meilleure série, la frise de l'année |
| 2 · les verdicts | un principal à la fois — **verdict seul**, jamais de fusées |
| 3 · les secondaires | un écran pour tous, un verdict chacun |

**Aucune note au bilan annuel** : la base la refuse (`review_item_rating_not_for_year`), et
c'est juste — un an ne se juge pas au rythme, il se conclut. Un objectif **clôturé** arrive
pré-rempli à « atteint » (SPEC §4.4) ; tout le reste arrive **vide**, parce que l'absence de
verdict n'est ni une réussite ni un échec.

**« Meilleure série » n'est pas le streak supprimé au §0.1.** Celui-là remettait à zéro et
repeignait en échec tout ce qui suivait un trou. Un **record** ne redescend pas : rater une
semaine ne l'efface pas. C'est la même promesse que « 143 jours actifs » du §9 — un compteur
qui ne peut structurellement pas avoir baissé.

**L'écran 2 reprend l'écran de notation existant à l'identique** — `RocketRating`,
`Au sol / En vol / En orbite`, la note libre, la bande d'évolution. C'était déjà le bon écran.

**L'écran 3 est volontairement partagé.** Un principal a droit à son deck et à ses 280
caractères ; un secondaire à une ligne et trois fusées compactes. La différence de traitement
*est* la définition du secondaire.

**L'écran 4** propose trois issues de poids égal : un nouvel objectif, reprendre un objectif
arrêté, ou **laisser la place vide** — qui est une décision, pas un manque. Puis les jalons du
trimestre suivant (cap 4, contrainte `milestone_cap` existante).

**« Pas atteint » ne prolonge rien.** Reprendre en T4, c'est créer la suite — la frise affiche
alors deux segments consécutifs, ce qui se lit comme de la continuité.

## Ouverture

Le bilan a **deux portes, et pas d'enchaînement** : son encart sur le dashboard, et le bouton de
l'écran Année — sur la carte du trimestre comme dans son en-tête. Les deux mènent à
`/bilan/:year/:period`, et c'est la période **dans l'adresse** qui les distingue du rituel, dont
`/review` ouvre toujours la semaine en cours.

**Un seul encart de cérémonie à la fois** (`usePendingBilan`). Quand rituel et bilan sont ouverts
le même soir, le bilan passe devant : il est plus rare, il se périme (un slot se libère), et le
rituel reste faisable après. Deux rappels côte à côte transformeraient deux rendez-vous en
arriéré — exactement la dette que la refonte enlève. **Rien ne s'empile** : sauter le bilan de T2
ne le fait pas revenir à côté de celui de T3.

Un bilan validé reste **traversable et modifiable** : tout l'est, à tous les niveaux (SPEC §4.4).
C'est ce qui règle sans cas particulier le bilan rempli en janvier.

À ne pas confondre avec l'écran **Année** (§6) : le bilan est une cérémonie qu'on traverse une
fois, l'autre une page d'archive où l'on revient.

## Tests SQL

`02_regles_metier.sql` §9 : `achieved` accepté au trimestre, `rating` accepté au trimestre,
les deux ensemble rejetés, `achieved` toujours rejeté en semaine.

---

# §9 — Retour après une longue absence · `#dashboard/d1…d3`

> **Précisions d'implémentation.** Trois points que la maquette laissait ouverts.
>
> **`d3` se déclenche sur un seuil de régularité.** Rien en base ne dit qu'une
> régularité « a baissé » — il n'y a pas d'historique, et en fabriquer un pour ce
> seul écran serait disproportionné. La règle retenue : `objective_regularity`
> sous **50 %** sur les quatre périodes closes, mesure `habitude`, `cadence ≥ 2`,
> objectif non clôturé. Cinquante pour cent, c'est deux périodes vides sur quatre
> — au-dessus, l'objectif se rattrape seul en une période ou deux et proposer
> d'alléger serait prématuré. `cadenceOffers()` (`features/comeback/comebackContent.ts`)
> est le seul endroit où la règle vit. Une régularité **non mesurée** (objectif
> trop jeune) ne déclenche rien : on n'allège pas ce qu'on n'a pas mesuré.
>
> **`last_seen_on` à `null` ne vaut pas une absence.** Une donnée absente n'est
> pas un fait ; le premier appel estampille la date et se tait. C'est aussi ce qui
> évite que tous les comptes existants voient « Bon retour » le jour du
> déploiement.
>
> **La colonne est lisible des co-membres d'espace** — le `grant select` de 0002
> porte sur la table et la policy `profile_select_space_comembers` (0003) expose
> la ligne. Assumé : une date d'ouverture est une donnée faible, et les espaces
> sont hors périmètre de la refonte. La restreindre imposerait un `grant select`
> par colonne, donc l'interdiction du `select *` sur `profile`.

## Migration

| Objet | Rôle |
|---|---|
| `public.profile.last_seen_on date` | dernier jour applicatif d'ouverture |
| `public.touch_last_seen() returns date` | **renvoie la valeur précédente**, puis pose `private.today()` |

Un seul aller-retour : le client apprend l'écart et le serveur enregistre la visite dans le
même appel. Et le client ne forge pas la date — même doctrine que `completed_at` et
`closed_at`. Le `grant update` sur `profile` reste limité à `display_name` : la colonne ne
s'écrit que par la RPC.

## Front

Page **plein écran, hors de la coquille** — ce n'est pas une variante du dashboard, c'est un
moment. Trois decks, déclenchés au-delà d'un seuil d'absence (7 jours).

| Deck | Contenu |
|---|---|
| `d1` | `BON RETOUR` · **143** jours actifs cette année · « Vos objectifs sont là où vous les avez laissés » |
| `d2` | l'état des trois objectifs, une carte chacun |
| `d3` | **conditionnel** — l'ajustement de cadence |

**On mène avec le cumul.** « 143 jours actifs cette année » est le seul chiffre qui ne peut
structurellement pas avoir baissé pendant une absence. C'est la preuve que rien n'a été retiré
— c'est précisément à ça que sert un compteur monotone.

**Le titre de `d2` doit rester vrai.** Rien n'avance tout seul : c'est l'utilisateur qui court
et qui fait ses virements. La seule chose qui a bougé *passivement*, c'est la régularité — des
périodes vides sont entrées dans la fenêtre de quatre. D'où « Seule votre régularité a bougé ».

**Chaque carte porte sa cadence sous le titre** (`Habitude · 3×/semaine`), sinon les valeurs de
droite flottent et on ne comprend pas pourquoi elles ne se comparent pas. Barre pour les types
mesurables, pastilles pour les jalons — une barre sous-entend une pression du temps qui
n'existe pas pour eux.

**`d3` n'apparaît que si un objectif à cadence a perdu de la régularité.** Changer un réglage
est une décision, et une décision mérite son écran : sur-titre nommant l'objectif à sa couleur,
`3 → 2` en gros, la question posée telle quelle, et la seule crainte réelle traitée en une
ligne — *la cible ne bouge pas, seule la cadence change*. Avec deux objectifs concernés, ce
sont deux écrans successifs.

La promesse est tenue **par le code et pas seulement par la copie** :
`useAdjustCadence()` n'envoie que `cadence`, là où `useUpdateObjective()` renverrait
tout un `ObjectiveEdits`. Une phrase qui dépend de ce que l'appelant a bien voulu
mettre dans son payload est une phrase qu'on finit par démentir.

## Ouverture

**Un overlay monté dans `AppShell`**, à côté d'`OnboardingFlow`, et non une route :
l'écran s'ouvre tout seul, un gate de redirection dans `ProtectedRoute` ferait
dépendre chaque route d'un état qui ne la concerne pas. Les deux ne peuvent pas se
croiser — quelqu'un qui revient est onboardé. La coquille est `RitualOverlay`, la
même que le rituel (§7) et le bilan (§8) ; sa prop `total` absorbe le **2 ou 3**
écrans selon que `d3` se montre, ce qui règle l'incohérence de la maquette (`d1`
déclare `total:2`, `d2` et `d3` `total:3`).

**L'écart n'est lisible qu'une fois.** `touch_last_seen()` écrit dans le même
aller-retour qu'elle lit : le second appel rend la date du jour, donc zéro. C'est
une **mutation**, jamais une query — une query qui écrit se rejouerait au retour de
focus et effacerait l'écart qu'elle vient d'annoncer — et `useLastSeen` fige le
résultat en state, même verrou que `ReviewPage` et `BilanPage`.

Conséquence assumée : **quitter l'écran le referme pour de bon**, la visite ayant
été enregistrée. C'est « rien ne s'empile » appliqué au retour — sauter l'accueil
ne le met pas en attente. Sans objectif principal, l'écran ne s'ouvre pas du tout :
il n'aurait ni chiffre ni cartes, et se lirait comme un état vide de plus.

## Tests SQL

`02_regles_metier.sql` §15 : la première visite rend `null`, la visite est
estampillée au jour applicatif, rouvrir le même jour ne fabrique pas d'absence,
l'écriture directe de `last_seen_on` part en `42501`, et la RPC ne touche que la
ligne de l'appelant. Cette dernière assertion doit **endosser le rôle
`authenticated`** (`set_config('role', …, true)`) : le reste du fichier tourne en
superuser, qui contourne les grants de colonne.

---

# §10 — Vérification

## À chaque lot

```
npm run typecheck            # tsc -b
npm run lint                 # oxlint
npx supabase db reset        # rejoue migrations + seed
npm run db:types:local       # après toute migration
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
     -f supabase/tests/01_etancheite.sql
     # puis 02_regles_metier.sql et 03_dashboard_reads.sql
```

`npm run db:push:dry` avant tout push, et le push est déclenché par l'utilisateur seul.

## Tests SQL à étendre

| Fichier | Section | Modification |
|---|---|---|
| `02_regles_metier.sql` | §2 slots | exclusion de fenêtre : T1 + T3 sur le slot 1 accepté, annuel + T2 rejeté |
| | *nouveau* §15 | `touch_last_seen()` : écart, estampille serveur, grant de colonne, portée à l'appelant |
| | §3 cadence | réécrite autour de `measure` et de la forme par type |
| | §7 relevé | `objective_period`, cas hebdomadaire **et** mensuel |
| | §9 reviews | `achieved` au trimestre, exclusivité avec `rating` |
| | §11 backfill | un job par unité, idempotence conservée |
| | *nouveau* | régularité plafonnée par période, exclusion de la période courante |
| `03_dashboard_reads.sql` | concordance | `objective_active_days()` ↔ somme des périodes, pour les deux unités |

## Contrôles visuels

Chaque écran développé se compare à son ancre dans `maquettes/refonte.html`, en mobile **et**
en desktop. Quatre contrôles transverses :

1. Aucun état vide ne se lit comme un échec.
2. Aucun bleu ailleurs que sur une action.
3. Aucune explication de mécanique dans l'interface — elles sont dans ce document.
4. Les gestes de même valeur ont le même poids visuel (garder / reporter / abandonner).

---

## Annexe — récapitulatif des migrations

| Ordre | Objet | Section |
|---|---|---|
| 1 | `btree_gist`, `objective.quarter`, `window_range`, exclusions de slot | §1.1 |
| 2 | `objective.measure`, colonnes quantité, `objective_entry`, `objective_progress()` | §1.2 |
| 3 | `objective_week` → `objective_period`, `objective_regularity()`, jobs cron | §1.3 |
| 4 | `review_item` : `achieved` au trimestre | §8 |
| 5 | `profile.last_seen_on`, `touch_last_seen()` | §9 |

Deux de ces migrations recréent une vue chiffrée et son trigger (§0.2) : `objective`, deux fois
(1 et 2 — à fusionner en une seule migration si elles sont jouées ensemble).

À cette liste s'ajoute, livrée avec le §7 : `public.objective_session` — la séance enregistrée
sans tâche, qui fait d'un jour crédité l'**union** des jours de tâches et des jours de séances
(`refresh_objective_period()` et `objective_active_days()` réécrites).
