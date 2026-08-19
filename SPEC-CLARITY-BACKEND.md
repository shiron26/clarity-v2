# Clarity — Spécification backend

Document de référence pour la réécriture. Il couvre le modèle de données et les règles
métier. Le front n'est pas traité ici, à l'exception des règles que le backend doit
appliquer (filtres de vues, prédicats, contraintes).

---

## 1. Principes directeurs

Trois principes se sont dégagés au fil des décisions. Ils tranchent d'avance la plupart
des questions non couvertes par ce document.

**Clarity ne note pas à votre place.** L'app mesure deux choses, et deux seulement : une
**régularité** (tenu sur attendu, sur les quatre dernières périodes closes) et une
**progression** quand l'objectif porte une cible. Elle n'en tire aucun verdict. Le jugement
reste humain — en fusées chaque semaine, par un verdict au trimestre et à l'année — et il
tranche là où le chiffre ne peut pas.

> **Amendé par [SPEC-REFONTE.md](./SPEC-REFONTE.md) §0.1.** La version initiale de ce
> principe interdisait tout score calculé (« ni pourcentage, ni streak, ni barre de
> complétion »). La refonte le renverse sur le calcul, pas sur le verdict : ce qui reste
> banni, c'est que l'app conclue à la place de l'utilisateur.

**Clarity ne reporte jamais rien automatiquement.** Un jalon non accompli ne bascule pas au
trimestre suivant, un objectif non atteint ne se reconduit pas en janvier, une occurrence
récurrente ne se génère pas tant que la précédente n'est pas cochée, et elle ne se coche
pas avant son échéance (§4.3). Réécrire est toujours un acte volontaire.

**Deux tempos, jamais mélangés.** Ce qui se joue à la semaine (cadence, tâches, jours
actifs) et ce qui se joue au trimestre (jalons) sont deux systèmes indépendants qui ne se
croisent jamais.

---

## 2. Architecture

SPA React (Vite) parlant directement à PostgREST. Aucune couche serveur sur le chemin des
données.

### Chiffrement

Une clé unique appartenant à l'application chiffre les données de tous les utilisateurs.
Elle protège contre une fuite de base, une sauvegarde égarée ou un accès en lecture non
prévu — pas contre les administrateurs du projet, qui restent techniquement capables de
déchiffrer.

- Clé stockée dans **Supabase Vault**
- Chiffrement par **`pgcrypto`** (`pgp_sym_encrypt` / `pgp_sym_decrypt`)
- Ne pas utiliser `pgsodium` ni sa Transparent Column Encryption (en cours de dépréciation)
- Lecture via des **vues déchiffrantes** en `SECURITY DEFINER`, avec le prédicat
  d'autorisation dans le `WHERE` de la vue
- La fonction qui lit le Vault ne doit **jamais** être exécutable par `authenticated` :
  sinon un utilisateur récupère la clé. Révoquer aussi l'accès direct aux tables de base.
- Écriture via triggers `INSTEAD OF` sur les vues, ou RPC

Conséquences : pas d'index ni de recherche serveur sur les champs chiffrés (un index sur
`decrypt(col)` stockerait le clair). La recherche se fait côté client, en mémoire. Le
Realtime diffuse la ligne brute, donc chiffrée : traiter la notification comme un signal et
invalider la query correspondante, jamais lire le payload.

**Champs chiffrés** (suffixe `_enc`, type `bytea`) : titres, labels, descriptions et
« pourquoi » des objectifs ; titres et descriptions des tâches ; titres des jalons ; noms
des listes ; noms des espaces ; commentaires de review.

### Conventions transverses

- Fuseau **Europe/Paris pour tous les utilisateurs**, dans une constante de configuration
  et non en dur dans les requêtes
- Semaine **lundi → dimanche**
- Un objet appartient soit à un utilisateur, soit à un espace : `user_id` et `space_id`
  sont exclusifs
- Attention à deux notions de position homonymes : le **`slot`** d'un objectif est un
  emplacement figé, la **`position`** d'un jalon ou d'une tâche est un index réordonnable.
  Les nommer différemment.

---

## 3. Modèle de données

### profile

```
profile
  id            uuid pk, référence auth.users
  display_name  text
  deleted_at    timestamptz?
```

L'avatar est constitué des initiales du nom, il n'y a aucun stockage de fichier dans le
produit. L'email vit dans `auth.users`, sert à la connexion et à l'invitation, et n'est
jamais exposé aux membres d'un espace.

**Suppression de compte : ne jamais supprimer la ligne.** On renseigne `deleted_at` et on
vide le nom. Une suppression réelle ferait cascader les clés étrangères et détruirait
l'historique des espaces partagés. Les contributions restent, anonymisées.

### space

```
space
  id, name_enc, color

space_member
  space_id, user_id, joined_at, left_at?
  contrainte : max 4 membres actifs par espace

space_invitation
  space_id, email?, token, expires_at, accepted_by?, accepted_at?
```

Il n'y a **pas de propriétaire ni de rôle** : tous les membres ont exactement les mêmes
droits sur les objectifs, les listes et les tâches de l'espace. Les objectifs forkés font
exception : ils appartiennent à leur auteur.

Un membre qui quitte un espace laisse tout ce qu'il a produit — forks, tâches,
commentaires, jalons cochés — en lecture seule. Rien n'est supprimé, l'historique des
semaines passées reste stable.

Un espace dont tous les membres sont partis est conservé indéfiniment. Il devient
définitivement inaccessible : aucun nettoyage n'est prévu en v1.

### objective

```
objective
  id
  user_id | space_id
  parent_objective_id   uuid?    -- fork : pointe vers un principal d'espace
  year                  int
  quarter               smallint?  1-4, null = objectif annuel
  window_range          daterange  généré depuis (year, quarter), bornes [début, fin)
  kind                  'principal' | 'secondaire'   -- null pour un fork
  slot                  smallint                     -- null pour un fork
  label_enc             bytea    NOT NULL
  title_enc             bytea    NOT NULL
  why_enc               bytea?
  description_enc       bytea?
  measure               'habitude' | 'quantite' | 'jalons'
  period_unit           'week' | 'month' ?   -- null pour jalons
  cadence               smallint?  check between 1 and 31 (≤ 7 si period_unit = 'week')
  target_value          numeric?   -- en clair, assumé
  unit                  text?      -- libellé d'affichage, null = sans unité
  entry_mode            'cumul' | 'releve' ?   -- quantité seulement
  direction             'atteindre' | 'sous' ?  -- quantité seulement, déduite
  start_value           numeric?   -- quantité seulement, origine de l'échelle
  closed_at             timestamptz?
  created_by            uuid
```

**La fenêtre d'un objectif n'est plus l'année.** `window_range` la dérive de `(year, quarter)`
en bornes `[début, fin)` : un T1 va du 1<sup>er</sup> janvier au 1<sup>er</sup> avril exclu,
un annuel du 1<sup>er</sup> janvier au 1<sup>er</sup> janvier suivant. Les slots sont uniques
**par chevauchement de fenêtre**, pas par année — deux contraintes d'exclusion GiST le disent
déclarativement. Conséquence : trois principaux **simultanés**, jusqu'à douze dans l'année, et
jamais deux objectifs simultanés de la même couleur (l'identité visuelle vient du slot).

**Trois types de mesure**, portés par `measure` :

| | `cadence` | `period_unit` | `target_value` | `entry_mode` | `direction` / `start_value` |
|---|---|---|---|---|---|
| `habitude` | requis, ≤ 7 si `week` | requis | facultatif | — | — |
| `quantite` | — (1 par période) | requis | **requis** | requis | **requis** |
| `jalons` | — | — | — | — | — |

`habitude` est réservée aux principaux perso et aux forks : un secondaire n'a pas de demande
périodique, un objectif d'espace n'a pas de rythme propre (§4.2). `measure`, `period_unit`,
`entry_mode` et `start_value` sont **figés à la création** — changer de nature, c'est supprimer
et recréer.

**Une quantité a un SENS et une ORIGINE**, et les deux sont nécessaires pour que sa
progression veuille dire quelque chose :

- `start_value` est le point de départ. `0` pour un cumul (il part de zéro par définition), la
  valeur du jour pour un relevé — la même valeur est aussi posée en premier `objective_entry`,
  et ce n'est pas un doublon : la colonne est l'origine figée de l'échelle, la saisie est la
  valeur du jour, qui bouge. La progression se mesure sur la distance `départ → cible`, jamais
  sur la cible seule.
- `direction` dit de quel côté on va. Elle n'est **jamais demandée à l'utilisateur** : elle se
  déduit du point de départ face à la cible — au-dessus, c'est `'sous'` (perdre du poids,
  éteindre une dette) ; en dessous ou égal, `'atteindre'`. Contrairement à `start_value` elle
  reste **modifiable**, et elle doit l'être : la cible bouge, et la faire passer de 70 à 85 kg
  quand on part de 78 retourne le sens de l'objectif. Le client la recalcule à chaque écriture.

Le pourcentage affiché vaut donc `(valeur − départ) / (cible − départ)` à la hausse, et
`(départ − valeur) / (départ − cible)` à la baisse, borné à `[0, 100]` des deux côtés.

**Trois natures d'objectif**, avec des mécaniques distinctes :

| | Slot | Cadence | Tâches | Jalons | Noté en hebdo |
|---|---|---|---|---|---|
| Principal perso | 1–3 | oui, obligatoire | oui | oui | oui |
| Secondaire perso | 1–5 | non | **non** | oui | non |
| Principal d'espace | 1–3 | non | **non** | oui | via ses forks |
| Secondaire d'espace | 1–5 | non | **non** | oui | non |
| Fork | aucun | oui | oui | non | oui, dans l'espace |

Le `slot` est un **emplacement figé** attribué à la création, qui détermine l'identité
visuelle. Supprimer un objectif libère son slot sans décaler les autres ; une création
prend le plus petit slot libre parmi ceux qu'aucune fenêtre chevauchante n'occupe. Un
objectif clôturé **ne libère pas** son slot : c'est la fin de sa fenêtre qui le libère.

**Le fork.** Un membre peut forker un objectif **principal** d'espace (jamais un
secondaire, qui n'a pas de cadence) pour en faire un objectif personnel avec son propre
rythme. Un fork par membre et par objectif d'espace. Il ne consomme aucun slot et ne porte
pas de `kind`. La suppression d'un objectif d'espace est **bloquée tant qu'il existe des
forks** (`on delete restrict`) : chaque membre doit d'abord supprimer le sien.

**Trois marqueurs d'état indépendants**, dont aucun ne se déduit des autres :

- `closed_at` — posé volontairement, signifie « atteint », **réversible**
- l'archivage — **dérivé**, pas de colonne : `year < année courante` ⇒ lecture seule
- le verdict du bilan annuel — inscrit dans `review_item.achieved`

L'archivage est volontairement dérivé pour n'exiger aucun job annuel ni migration. Il gèle
l'objet, **pas le jugement porté sur lui** : un objectif archivé reste modifiable dans le
bilan annuel.

**Visibilité d'un objectif dans une période de review**, règle unique aux trois niveaux :

```
closed_at IS NULL  OR  closed_at >= début de la période
```

La période en cours au moment de la clôture inclut l'objectif une dernière fois ; celles
qui commencent après ne le voient plus.

### milestone

```
milestone
  id, objective_id, year, quarter (1-4), position
  title_enc
  completed_at?, completed_by?
  contrainte : max 4 par (objective_id, year, quarter)
```

Titre seul : ni description, ni date cible. Portés par toutes les natures d'objectif sauf
les forks — c'est la seule mécanique des objectifs secondaires.

- Un jalon non coché **reste dans son trimestre**. Pour le poursuivre, on le réécrit
  ailleurs.
- Aucun déplacement entre trimestres.
- On peut créer des jalons pour n'importe quel trimestre de l'année, soit jusqu'à 16 par
  objectif — le jalon est aussi un outil de planification en janvier.
- On peut cocher librement un jalon d'un trimestre passé de l'année en cours.
- Suppression libre, coché ou non. C'est le seul moyen de nettoyer les jalons réécrits.
- Sur un objectif d'espace, n'importe quel membre coche et décoche — d'où `completed_by`.
- **Cocher un jalon ne produit aucun signal ailleurs** : ni jour actif, ni compteur. Il
  n'apparaît qu'au bilan trimestriel.

### list

```
list
  id, user_id | space_id
  name_enc, color, position
```

Un contenant de tâches, sans aucun rapport avec les objectifs — les deux dimensions sont
indépendantes. Pas de pourcentage de progression.

Depuis le contexte perso, on voit les listes des espaces dont on est membre et on peut
**cocher, créer et modifier leurs tâches** ; en revanche la gestion des listes elles-mêmes
(créer, renommer, supprimer) reste dans le contexte espace, où tous les membres ont les
mêmes droits.

Supprimer une liste **détache** ses tâches (`on delete set null`) sans les supprimer.

### task

```
task
  id
  user_id | space_id
  assignee_id     uuid?      -- optionnel, tâches d'espace
  list_id         uuid?
  objective_id    uuid?
  title_enc, description_enc?
  due_date        date?      -- date seule, sans heure
  is_important    boolean
  position        int
  recurrence      jsonb?     -- { type, interval, weekdays[] }
  completed_at?, completed_by?
```

Pas de statut ni de colonnes Kanban : une tâche est faite ou pas faite. Pas d'échelle de
priorité, un simple drapeau `is_important`. La suppression est définitive, il n'y a pas de
corbeille.

`space_id` est une **colonne propre à la tâche**, jamais déduite de `list.space_id` :
sinon, supprimer une liste transformerait des tâches partagées en orphelines invisibles.

`objective_id` ne peut pointer que vers un **principal perso** ou un **fork** — jamais vers
un secondaire ni vers un objectif d'espace. Une tâche rangée dans une liste partagée peut
être rattachée au fork de celui qui l'y rattache ; elle n'a **qu'un seul lien**, et le
crédit tombe sur le propriétaire du fork quel que soit le membre qui coche.

Une tâche sans liste, sans objectif et sans date reste accessible dans la vue « Toutes ».
Les tâches non terminées d'un objectif archivé sont archivées avec lui.

### objective_period

```
objective_period
  objective_id, period_unit ('week' | 'month'), period_year, period_index
  target   smallint   -- figée : la valeur en vigueur cette période-là
  done     smallint
  pk (objective_id, period_unit, period_year, period_index)
```

Cette table existe pour une seule raison : la cadence d'un objectif peut changer en cours
d'année. Une vue recalculée réécrirait rétroactivement l'historique avec la cadence
actuelle, transformant des mois de réussite en échecs. La cible doit donc être figée.

Une seule table pour toute la régularité, quel que soit le type :

| `measure` | `target` | `done` |
|---|---|---|
| `habitude` | `cadence`, figée à la première activité de la période | jours crédités distincts |
| `quantite` | `1` — une saisie attendue par période | `0` ou `1` |
| `jalons` | *aucune ligne* | — |

> **Amendé par SPEC-REFONTE §1.3.** S'appelait `objective_week` et ne savait compter que des
> semaines (`iso_year` / `iso_week` / `cadence_target` / `active_days`).

### objective_entry

```
objective_entry
  id, objective_id
  entry_date  date       -- posée par le serveur au jour applicatif
  value       numeric
  created_by, created_at
```

Les saisies d'un objectif quantifié, en clair. `value` est un nombre nu — jamais `"3 850 €"` ;
`unit` n'est qu'un libellé d'affichage. En mode `cumul` les saisies s'additionnent, en mode
`releve` la dernière remplace la précédente et **peut baisser** (un solde, un poids). Saisir
un relevé antidaté n'est pas un besoin du produit : `entry_date` vient du serveur, même
doctrine que `completed_at` et `closed_at`.

### review / review_item

```
review
  id
  period_type          'week' | 'quarter' | 'year'
  period_year          int
  period_index         int?          -- n° de semaine ISO, 1-4, ou null
  user_id | space_id
  validated_at?, validated_by?
  current_objective_id uuid?         -- curseur partagé de session
  unique (user_id|space_id, period_type, period_year, period_index)

review_item
  review_id, objective_id
  rating       smallint?   check 1..3   -- semaine et trimestre
  achieved     boolean?                 -- année
  comment_enc  bytea?                   -- 280 caractères
  unique (review_id, objective_id)
```

Les trois niveaux partagent la même table, la même mécanique de session et le même écran
paramétré. Seule la règle de portée change.

---

## 4. Règles métier

### 4.1 Cadence et jours actifs

La cadence est le nombre de fois **par période** où l'on doit avancer sur un objectif — la
période étant la semaine ou le mois (`period_unit`). En hebdomadaire, un entier de 1 à 7 ;
« Quotidien » n'est pas un cas particulier, c'est simplement 7. Elle est obligatoire sur les
objectifs de mesure `habitude` — principaux perso et forks — et absente partout ailleurs.

Elle existe pour corriger un faux échec : un objectif poursuivi trois fois par semaine ne
doit pas apparaître comme quatre jours d'inactivité.

**Le compteur compte des jours distincts, pas des tâches.** Trois tâches cochées le lundi
valent un jour actif, pas trois. L'unité mesurée est « un jour où j'ai avancé sur cet
objectif ».

**Jour crédité par une complétion :**

```sql
credit_day = least(coalesce(due_date, current_date), current_date)
```

Échéance passée, on crédite l'échéance ; échéance future ou absente, on crédite
aujourd'hui.

**Alimentation de `objective_period` :**

- Un **trigger** sur la complétion d'une tâche fait un `upsert` : il crée la ligne à la
  première activité de la période en y figeant la cible en vigueur, ou recalcule `done`.
  Un trigger symétrique sur `objective_entry` fait de même pour les objectifs quantifiés.
- Un **job par unité** (lundi 00:15 UTC, 1<sup>er</sup> du mois 00:15 UTC) ne s'occupe que
  des périodes restées vides, pour qu'elles apparaissent à 0 dans les bilans plutôt que
  d'être absentes. Il doit être idempotent et rattraper les périodes manquées s'il a échoué.
- Le relevé **n'est pas immuable** : une tâche en retard cochée plus tard met à jour la
  période concernée.
- Pendant une période de clôture, **aucune ligne n'est produite**. Après réouverture, ces
  périodes restent absentes plutôt que rattrapées à zéro : le relevé raconte quand
  l'objectif était vivant, pas une suite d'échecs.

**Régularité** (SPEC-REFONTE §1.3) : sur les **4 dernières périodes closes**, la part de
l'attendu qui a été faite, **chaque période plafonnée à 100 %**. Une semaine à 5 séances sur 3
ne rachète pas une semaine à 0 — on mesure un rythme, pas un volume. Une période close est
strictement antérieure à la période courante : le chiffre ne bouge donc qu'au passage à la
période suivante, jamais pendant qu'on la vit. Rater une période coûte 25 points et se répare
seul quatre périodes plus tard — rien ne remet à zéro.

### 4.2 État hebdomadaire d'un objectif d'espace

Un objectif d'espace ne porte aucune tâche. Son état se **déduit** de celui de ses forks —
il n'a donc pas de ligne `objective_period` propre, on recalcule à la lecture. Une seule
source de vérité : les forks.

Trois valeurs :

- **tenu** — une majorité des membres ayant forké a atteint sa cadence cette semaine-là
- **non tenu** — sinon
- **non évalué** — personne n'a forké l'objectif

Le bilan annuel doit traiter « non évalué » comme ni réussite ni échec.

### 4.3 Récurrence

Il n'existe **aucun objet « série »** : seulement une chaîne de tâches, chacune portant sa
règle, recopiée d'une occurrence à la suivante. Pas de table de séries, pas de génération
anticipée, pas de job. Supprimer la tâche courante arrête la récurrence.

- La prochaine occurrence est créée **à la complétion**. Si l'on ne coche jamais, rien ne
  se régénère : une habitude ratée trois fois reste une seule tâche en retard, pas trois.
- La prochaine échéance se calcule **à partir de la date de complétion**, pas de
  l'échéance : la série se recale sur le comportement réel plutôt que de fabriquer des
  retards en cascade.
- **Une occurrence ne se coche pas avant son échéance** (`task_recurrence_future`). C'est
  la conséquence directe du point précédent : cocher aujourd'hui une quotidienne due
  demain engendrerait une occurrence… demain, soit un doublon de celle qu'on vient de
  cocher, et chaque clic en refabriquerait une. Cette règle rend l'invariant vrai par
  construction : la suivante tombe **strictement après** celle qu'on coche. Contrepartie
  assumée : une tâche faite en avance demande d'abord d'avancer sa date. La règle épargne
  les tâches sans échéance (qui s'ancrent sur aujourd'hui) et les non récurrentes.
- La forme de la règle est **validée en base** (`task_recurrence_shape`) : `type` parmi
  les trois motifs, `interval` entier de 1 à 366, `weekdays` dans 1..7, aucune autre clé.
  Sans cette contrainte, un `weekdays` hors bornes faisait boucler le calcul sans fin.
- **Passer son tour** (`skip_task_occurrence`) déplace l'échéance à la suivante, sans rien
  supprimer ni recréer. C'est ce que choisit l'utilisateur quand il supprime une tâche qui
  se répète et répond « seulement cette fois ». L'ancre est ici l'échéance sautée, et non
  le jour courant : un lundi sauté revient au lundi suivant. Une échéance déjà passée
  repart d'aujourd'hui, sinon la nouvelle occurrence naîtrait en retard.
- Motifs : quotidien, hebdomadaire, mensuel ; jours précis de la semaine ; toutes les N
  semaines. Pas de RRULE complet.
- Un mensuel posé le 31 tombe sur le **dernier jour du mois** quand le mois est plus court.
  Conséquence à connaître : comme le calcul repart de la date de complétion, l'ancrage au
  31 est perdu définitivement après un seul passage par février.
- Sans fin : ni date de terme, ni nombre d'occurrences.
- **Un seul lien entre occurrences, et pour une seule raison** : `private.task.generated_from`
  pointe vers l'occurrence dont la complétion a créé celle-ci. Il existe uniquement pour
  **défaire cette complétion** : décocher supprime l'occurrence engendrée, à condition
  qu'elle soit encore décochée. Sans lui, décocher puis recocher laissait deux tâches
  futures, et N cycles en laissaient N. Ce lien n'est **pas exposé au client** (il n'entre
  pas dans `public.task`), il ne survit pas à la suppression de son parent
  (`on delete set null`), et il ne fait pas de la chaîne un objet « série » : il n'y a
  toujours ni table de séries, ni suppression groupée, ni remontée d'historique.
- Une série dont l'objectif vient d'être archivé continue de générer, mais le générateur
  crée l'occurrence suivante avec `objective_id = null`. Aucun job n'est nécessaire : la
  règle s'applique d'elle-même à la première occurrence de janvier.

### 4.4 Reviews

| | Semaine | Trimestre | Année |
|---|---|---|---|
| Porte sur (perso) | principaux | principaux + secondaires | principaux + secondaires |
| Porte sur (espace) | forks | forks | forks |
| Saisie | fusées 1–3 + commentaire | fusées 1–3 + commentaire | verdict atteint/non + commentaire |
| Ouverture | vendredi 18h | dernier vendredi du trimestre, 18h | dernier vendredi de décembre, 18h |

- Un commentaire de 280 caractères **par objectif**, pas un commentaire global de période.
- Tout est **librement modifiable après coup**, à tous les niveaux. C'est ce qui règle sans
  cas particulier toutes les situations de rétroactivité : complétion tardive, jalon coché
  au trimestre suivant, bilan rempli en janvier.
- Un objectif clôturé disparaît des reviews hebdo et des bilans trimestriels suivants, mais
  reste au bilan annuel avec son verdict **pré-rempli à « atteint »**.
- Un objectif abandonné n'a pas d'état dédié : il reste actif, accumule des semaines à zéro,
  et reçoit un verdict « non atteint » en décembre. Le verdict couvre les deux issues.
- La dernière semaine d'un trimestre porte les deux rituels **séparément**. Le dernier
  vendredi de décembre en porte trois.
- Le bilan annuel reste remplissable **après le 1er janvier**, alors même que les objectifs
  sont archivés.

**Sessions d'espace.** La review d'espace est interactive aux trois niveaux : tous les
membres voient la même chose en même temps. C'est la seule fonctionnalité du produit qui
exige réellement du temps réel.

- N'importe quel membre démarre la session ; l'unicité sur
  `(space_id, period_type, period_year, period_index)` empêche deux sessions concurrentes.
- Celui qui a démarré valide à la fin.
- Un membre absent note ses forks plus tard, hors session : sa présence n'est pas requise
  pour valider. « Validée » signifie donc « la session a eu lieu », pas « tout le monde a
  noté ».
- `current_objective_id` porte le curseur partagé. C'est un UUID, il transite en clair par
  le Realtime ; les notes et commentaires, eux, doivent être rechargés à la notification.
- Les commentaires des forks sont **visibles par tous les membres**. La confidentialité
  découle du type d'objectif, sans réglage : les commentaires d'un principal perso ne
  sortent jamais, ceux d'un fork sont publics dans leur espace. Les commentaires d'un
  membre parti restent lisibles.
- Le « pouls de l'équipe » (moyenne des notes des membres) est conservé au bilan
  trimestriel — seule métrique agrégée qui subsiste dans le produit.

---

## 5. Vue Tâches

Un même jeu de tâches vu à travers des prédicats différents : un seul composant, une seule
requête paramétrée.

| Vue | Contenu |
|---|---|
| Aujourd'hui | `due_date = aujourd'hui`, plus les tâches en retard **en section distincte** |
| Demain | `due_date = demain` |
| Cette semaine | d'aujourd'hui à dimanche — fenêtre qui rétrécit au fil de la semaine |
| En retard | `due_date < aujourd'hui and completed_at is null` |
| Toutes | aucun filtre |
| Par liste | `list_id = ?` |

- Les tâches cochées restent visibles, barrées, **jusqu'à la fin du jour**.
- Tris et filtres **non mémorisés** : aucune préférence à stocker. Le tri par défaut est
  toujours **manuel**, la seule autre option étant l'importance. Il n'y a pas de tri
  « par date » : les vues qui couvrent plusieurs jours (« Cette semaine », « Toutes »,
  une liste) **groupent** leurs lignes par échéance sous un en-tête de jour, et
  rassemblent les tâches sans date dans une section repliable en fin de liste.
- **Recherche** sur les titres, côté client, sur les tâches actives uniquement.
- **Report en masse** : une RPC, seule action groupée du produit.

```sql
update task set due_date = current_date
where due_date < current_date
  and completed_at is null
  and space_id is null;   -- jamais de tâche partagée
```

L'exclusion des tâches d'espace est délibérée : c'était le seul endroit où une action
personnelle aurait modifié des données collectives sans que les autres le sachent.

---

## 6. Retiré de la spécification initiale

| Élément | Motif |
|---|---|
| ~~Progression (%) d'un objectif~~ | **Réintroduite** (REFONTE §0.1), mais **bornée par type** : une progression n'existe que si l'objectif porte une cible. Une habitude sans cible totale n'en a pas. |
| ~~Streak~~ | **Remplacé** (REFONTE §0.1) par la régularité glissante sur 4 périodes closes, plafonnée à 100 % par période. Rien ne remet à zéro, donc plus de pénalité structurelle des cadences non quotidiennes. |
| Pourcentage de progression des listes | Cohérence avec le reste |
| Kanban et statuts | Source principale de la surcharge de `/tasks` |
| Échelle de priorité | Remplacée par un drapeau |
| Lien objectif → liste | Couplage coûteux ; deux dimensions désormais indépendantes |
| Vote à l'unanimité sur les objectifs d'espace | Supprime états, décompte, condition de course et écran |
| Partenaire de responsabilité | Doublon d'un espace à deux |
| Notion d'ami | Un réseau social entier pour une invitation |
| ~~Objectif quantifié~~ | **Réintroduit** (REFONTE §0.1) comme type de mesure à part entière — `measure = 'quantite'`, table `objective_entry`. |

---

## 7. Reste à spécifier

- **L'invitation à un espace** — inviter par email quelqu'un sans compte, durée de vie et
  usage unique ou non du lien
- **Les notifications** — probablement le rappel du vendredi 18h, la réception d'une
  invitation et l'assignation d'une tâche
- **Le module de planning et la synchro Google Agenda.** À trancher **avant** d'écrire les
  migrations : une échéance sans heure ne se pose pas sur un créneau d'agenda. Soit on
  ajoute l'heure sur la tâche, soit on crée une ressource distincte — et modifier une
  colonne chiffrée sur des données existantes est nettement moins agréable.
- **Les sous-tâches**, repoussées hors v1 (`parent_task_id`)

---

## 8. Ordre de construction suggéré

1. Extensions, Vault, clé applicative, fonctions de chiffrement et convention de vues
2. `profile`, `space`, `space_member` et les policies RLS — à écrire en premier et à
   tester, elles portent seules la sécurité du produit
3. `list`, `task` — la boucle de base, immédiatement utilisable
4. Vue Tâches et ses prédicats
5. `objective`, `milestone`, contraintes de slots
6. `objective_period`, trigger de complétion, jobs de backfill par unité
7. Forks et objectifs d'espace
8. `review` / `review_item`, les trois niveaux
9. Sessions interactives et Realtime

Les tables encore non spécifiées (invitation, notifications) peuvent attendre. En revanche,
mieux vaut poser dès la première migration les colonnes dont on sait qu'elles arriveront —
ajouter une colonne à une table dont les données sont déjà chiffrées reste faisable, mais
c'est le genre de migration qu'on repousse indéfiniment.
