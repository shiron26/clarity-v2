# Clarity — idées d'évolution (en vrac)

Carnet de notes, pas une spécification. On y jette une idée dès qu'elle passe, même
mal formulée : ce qui compte est de ne pas la perdre. Ce qui est validé et cadré part
dans [SPEC-REFONTE.md](./SPEC-REFONTE.md) ou [SPEC-CLARITY-BACKEND.md](./SPEC-CLARITY-BACKEND.md),
qui restent seuls à faire foi.

## Convention

Une idée = un bloc `###`, avec :

- **Statut** : `vrac` (juste noté) → `à creuser` (on sait pourquoi on la veut) →
  `cadré` (part en spec) → `abandonné` (garder la ligne et le pourquoi du non).
- **Le problème d'abord**, la solution ensuite. Une idée qui ne sait pas dire quel
  moment d'usage elle répare finit en fonctionnalité orpheline.
- **Questions ouvertes** en fin de bloc : c'est ce qui bloque le passage en spec.

Date d'ajout au format `AAAA-MM`. Pas de tri par priorité ici, on range plus tard.

---

## Dashboard

### Des widgets sur le dashboard
*Statut : fait — 2026-08-19*

L'accueil est une grille de trois colonnes (une seule en mobile) que l'utilisateur
compose : ordre au glisser-déposer, largeur au tiers / deux tiers / plein, ajout et
retrait depuis une palette. Six widgets existent : le rituel, l'horizon, la semaine (qui
porte aussi le retard), à trier, les étapes du trimestre, et les trois aide-mémoire
(Courses, Idées, Pense-bête), qui sont de vraies listes marquées `list.kind` et cachées de
l'écran Tâches. La bande d'objectifs et le bilan de trimestre, eux, sont épinglés hors
grille.

Les questions ouvertes ont été tranchées ainsi :

- **Client-only**, comme avant (`src/features/home/dashboardLayout.ts`). Une table
  viendra le jour où la disposition devra suivre d'un appareil à l'autre ; ce qui est
  stocké localement deviendra alors la valeur par défaut.
- **Grille libre**, pas une liste de blocs pleine largeur : en mobile, les largeurs sont
  simplement ignorées et l'ordre du tableau suffit, aucun écran à part n'a été nécessaire.
- **Pas de plafond** pour l'instant. Reste à surveiller : un accueil de douze widgets
  n'est plus un accueil.
- `usePrivacy` est respecté par les widgets qui montrent un titre d'objectif ou d'étape.

Restent en réserve, non construits : la régularité en widget, la mini vue Année, le relevé
rapide d'un objectif quantifié, la répartition de la semaine entre listes.

---

## Objectifs

### Objectifs très courts, à la semaine
*Statut : vrac — 2026-08*

Aujourd'hui l'horizon minimal est le trimestre. Il manque le cran en dessous :
« cette semaine, je veux faire ça », posé le lundi, soldé le dimanche. Ce n'est pas
une tâche (qui est un item à cocher) ni un objectif trimestriel (trop lourd à créer
pour sept jours).

Pourquoi : entre le rituel hebdomadaire et les tâches du jour, rien ne porte
l'intention de la semaine. Le rituel la fait écrire mais ne la garde pas visible.

Pistes :

- accroché au **rituel hebdomadaire** : on le pose en fin de rituel, on le solde au
  rituel suivant. Le cycle existe déjà, on ne crée pas de nouveau rendez-vous.
- une à trois intentions par semaine, plafond dur. Au delà, c'est une liste de tâches.
- rattachement facultatif à un objectif trimestriel, pour que la semaine « serve »
  quelque chose et alimente le bilan.

Questions ouvertes :

- Nouvelle entité chiffrée (table `private` + fonction `_rows()` + vue + triggers,
  cf. AGENTS.md) ou variante d'`objective` avec un `period_unit` semaine ? La deuxième
  est tentante et probablement fausse : `objective` porte slots, jalons, relevés,
  bilan trimestriel — beaucoup de machinerie pour sept jours.
- Que devient une intention non soldée au rituel suivant : elle expire, elle se
  reconduit, on demande ? Le silence est le pire choix.
- Est-ce que ça remonte dans le bilan trimestriel, et sous quelle forme ?
- Quelle semaine fait foi : la semaine ISO lundi→dimanche de `appDate.ts`, pour rester
  cohérent avec les périodes existantes.

---

## Intelligence du produit

### Des retours pertinents à l'utilisateur
*Statut : vrac — 2026-08*

L'application détient de quoi dire des choses justes : périodes closes, régularité,
jours actifs, historique des relevés, bilans passés. Elle ne dit rien. Idée : une
couche qui observe et renvoie des constats.

Formes possibles, de la plus sûre à la plus risquée :

- **constats factuels** : « quatrième semaine d'affilée sur cet objectif »,
  « trois relevés en douze jours, la cadence visée était quotidienne »
- **rapprochements** : les objectifs qui avancent quand un autre stagne, les jours de
  la semaine où rien n'est jamais coché
- **projection** : au rythme actuel, la cible tombe fin novembre, pas fin septembre
  (les valeurs projetées existent déjà dans `objective_regularity()`)
- **suggestions** : baisser une cadence tenue à 40 % depuis six semaines, archiver un
  objectif sans relevé depuis un trimestre

Principes à tenir :

- **Calculé côté serveur, en SQL.** La règle de progression vit déjà en base
  (`credit_day`, `objective_active_days()`, `objective_regularity()`), et AGENTS.md
  interdit de la réimplémenter en TS. Un constat qui contredit la carte d'objectif est
  pire que pas de constat.
- **Aucune donnée en clair ne sort de la base.** Les titres sont chiffrés, le produit
  parle directement à PostgREST : un appel à un modèle externe sur les contenus
  utilisateur est hors sujet tant que ce point n'est pas tranché explicitement. Une
  première version qui ne raisonne que sur des **chiffres et des dates** (jamais sur
  les titres) évite entièrement la question.
- **Le ton n'est pas celui d'un coach.** Constater, pas encourager, pas juger. Une
  phrase fausse ou moralisatrice décrédibilise tout le reste, y compris les chiffres
  qui, eux, sont exacts.
- **Rien qui parle pour ne rien dire.** Pas de bandeau quotidien : s'il n'y a pas de
  constat, il n'y a pas de bloc. Le vide est un état valable.

Questions ouvertes :

- Où ça s'affiche : widget dashboard, page Objectif, ou dans le rituel / le bilan, là
  où l'utilisateur est déjà en posture de relecture ? Le rituel semble le bon endroit.
- Règles déterministes écrites à la main, ou modèle ? Commencer par les règles : elles
  sont testables (`supabase/tests/`), explicables, et suffisent probablement pour 80 %.
- Fréquence de calcul : à la lecture, ou en tâche pg_cron comme le backfill hebdo ?
- Combien de constats à la fois avant que ça ne devienne du bruit ? Un ou deux.
- Comment se taire quand l'historique est trop court (compte neuf, premier trimestre) ?

---

## Bac à idées

Une ligne suffit ici. Ce qui grossit passe en bloc `###` au dessus.

- chiffrement de bout en bout (l'admin ne peut plus lire les contenus) : décision
  ouverte, analyse et options dans [CHIFFREMENT.md](./CHIFFREMENT.md)
