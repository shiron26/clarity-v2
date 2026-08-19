# Clarity — chiffrement : modèle de menace et question du bout en bout

*Statut : décision ouverte — 2026-08. Ce document n'est pas une spécification : il
constate ce qui existe, écarte les fausses pistes et décrit ce que coûterait le
changement. Tant qu'il n'a pas été tranché, [SPEC-CLARITY-BACKEND.md](./SPEC-CLARITY-BACKEND.md)
§2 fait foi et le modèle actuel reste en place.*

## 1. Le constat de départ

Dans Supabase Studio, le Table Editor sur `public.task` affiche « This table is empty »,
et l'onglet « View data as a role » → *Authenticated* → un utilisateur affiche **les
titres des tâches en clair**.

Les deux comportements sont normaux et cohérents :

- la vue est vide en rôle `postgres` parce que le `WHERE` de `public.task_rows()` filtre
  sur `auth.uid()`, qui vaut `NULL` sans JWT. Rien n'est masqué, il n'y a simplement
  aucune ligne qui satisfasse le prédicat ;
- l'impersonation pose les claims JWT, `auth.uid()` répond, la vue déchiffre.

L'impersonation n'ouvre aucune porte nouvelle : `select private.dec(title_enc) from
private.task` donne le même résultat en une requête. La clé vit dans le Vault du projet,
`private.app_key()` la lit, et le rôle `postgres` peut l'appeler. **Une clé symétrique
détenue par le serveur ne peut pas, par construction, cacher quoi que ce soit à qui
contrôle le serveur.**

C'est exactement ce que la SPEC annonce :

> Elle protège contre une fuite de base, une sauvegarde égarée ou un accès en lecture non
> prévu — pas contre les administrateurs du projet, qui restent techniquement capables de
> déchiffrer.

Le modèle actuel est donc correct par rapport à ce qu'il promet. La question ouverte est
de savoir si la promesse doit changer.

## 2. Debugger sans impersonation

Pour identifier une ligne sans lire de contenu, le squelette suffit et il est en clair
dans `private` (rôle `postgres`, qui a `BYPASSRLS`) :

```sql
select id, user_id, space_id, list_id, objective_id, due_date, is_important,
       position, recurrence, completed_at, completed_by, created_at,
       length(title_enc) as title_len
from private.task
order by created_at desc
limit 50;
```

Identifiants, dates, récurrence, état de complétion : de quoi diagnostiquer une occurrence
récurrente en double, une `due_date` aberrante ou une ligne orpheline. L'impersonation
reste réservée aux cas où il faut vraiment reproduire ce que voit l'utilisateur.

Variante en SQL Editor, scopée à la transaction (le `true` évite que le réglage fuite sur
la requête suivante) :

```sql
begin;
select set_config('request.jwt.claims',
                  json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);
select * from public.task order by created_at desc limit 50;
commit;
```

Note : les badges `UNRESTRICTED` de Studio sur `list`, `objective`, `task`… ne signalent
pas un trou. Studio les met sur toute vue sans RLS propre, et une vue SECURITY DEFINER
n'en a pas par construction : la restriction vit dans le `WHERE` de la fonction et dans
l'absence totale de grants sur `private` pour les rôles API.

## 3. Fausse piste : la clé dans le `.env` du front

L'idée « l'API renvoie du chiffré, le front déchiffre avec une clé de mon `.env` » ne
tient pas, pour une raison mécanique : Vite **inline** les variables `VITE_*` dans le
bundle au build. Ce sont des littéraux de chaîne dans le JS servi à tout le monde. La clé
anon est déjà visible dans le build courant :

```
$ grep -o 'eyJ[A-Za-z0-9_-]\{20,\}' dist/assets/index-*.js
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbWx6…
```

Pour la clé anon c'est voulu, elle est publique par conception. Une clé de déchiffrement
au même endroit le serait tout autant. Et il n'y a pas d'échappatoire : une variable sans
préfixe `VITE_` n'est pas accessible au code client du tout, et tout ce que le code client
peut lire, l'utilisateur peut le lire.

Deux conséquences :

- **ça ne résout pas le problème posé** : cette clé serait aussi dans le repo et dans le
  `.env` de l'administrateur, qui pourrait toujours tout lire ;
- **ça détruit la protection existante** : aujourd'hui la clé ne quitte jamais le serveur,
  donc un dump volé est inexploitable. Avec la clé dans le bundle, l'attaquant qui récupère
  le dump visite le site, prend la clé, déchiffre tout. Le chiffrement n'apporterait plus
  rien et le `WHERE` des vues ferait 100 % du travail de sécurité.

L'intuition n'est pourtant pas fausse : la **plomberie** décrite (API opaque, déchiffrement
front) est exactement celle du bout en bout. La seule différence est **d'où vient la clé** :
une constante partagée par tous, ou un secret propre à l'utilisateur. Le code de
déchiffrement est identique. D'où le mauvais compromis : on paie presque tout le coût sans
obtenir le bénéfice.

## 4. Ce que coûterait le vrai bout en bout

### Ce qui est facile (vérifié)

`private.dec()` n'est appelée **que** dans les fonctions `*_rows()` des vues :
`list_rows`, `task_rows`, `space_rows`, `objective_rows`, `milestone_rows`,
`review_item_rows`. Aucune logique métier ne touche au texte déchiffré :
`objective_progress`, `objective_regularity`, `objective_active_days`, `credit_day`,
l'attribution de slot, `postpone_overdue_tasks`, `week_task_count` — tout tourne sur des
colonnes structurelles. La création de l'occurrence récurrente suivante recopie
`new.title_enc` en bloc, sans le lire
(`20260813153011_0008_objective_week.sql`).

Conséquence : **il n'y a pas de logique serveur à réécrire**. Les vues cesseraient de
déchiffrer et renverraient le `bytea` tel quel, `private.enc` / `private.dec` /
`private.app_key` disparaîtraient, et le chiffrement/déchiffrement s'installerait dans les
hooks TanStack Query. Les champs concernés sont ceux listés en SPEC §2 (titres, labels,
descriptions, « pourquoi » des objectifs, noms de listes et d'espaces, commentaires de
review).

La recherche client-only est déjà la règle (SPEC §2) : rien de perdu de ce côté.

### Ce qui est cher

- **Gestion de clés.** Une DEK aléatoire par utilisateur (AES-GCM, WebCrypto), enveloppée
  par une KEK dérivée d'un secret utilisateur, le blob enveloppé stocké en base. La DEK ne
  vit qu'en mémoire.
- **Les espaces partagés.** Une DEK par espace, transmise à chaque membre via une paire de
  clés asymétrique par utilisateur (ECDH X25519), la clé privée elle-même enveloppée.
  L'invitation devient un échange de clés, plus une simple ligne en base. C'est la partie
  la plus lourde, et elle est incontournable dès que le partage existe.
- **Les migrations de contenu.** Aujourd'hui on peut rechiffrer ou retravailler une colonne
  en SQL. En bout en bout, toute migration touchant du contenu doit passer par les clients,
  en ligne, un utilisateur à la fois.
- **Le moment.** Le bon moment pour basculer était avant d'avoir des comptes réels et des
  espaces partagés en production. Ils existent déjà : une bascule implique une migration
  des données existantes, client par client.

## 5. Le mot de passe oublié

### L'arithmétique, d'abord

Si l'accès peut être rendu à quelqu'un qui a tout oublié, c'est que le secret est
récupérable sans lui, donc que l'opérateur peut déchiffrer. **« Récupération sans secret
détenu par l'utilisateur » et « l'opérateur ne peut pas lire » sont exclusifs.** Aucune
implémentation ne contourne ça ; tout schéma qui semble y arriver a déplacé la confiance
ailleurs sans la supprimer.

Les trois issues réelles :

| Option | Récupération | Contrainte |
|---|---|---|
| Pas de récupération | perte définitive au reset | inacceptable pour une app de productivité |
| Code de récupération | l'utilisateur conserve un code | écarté : trop de friction |
| **Passkey + extension `prf`** | la plateforme synchronise le secret | dépendance au support navigateur |

### L'option retenue à instruire : passkey PRF

L'extension WebAuthn `prf` permet de dériver d'une passkey un secret stable et
reproductible. L'utilisateur ne le voit jamais, ne le note jamais, ignore qu'il existe. Et
la passkey est **synchronisée par la plateforme** (trousseau iCloud, Google Password
Manager, 1Password) : la corvée de « garder la clé » est assurée par Apple ou Google, qui
le font déjà pour tous les mots de passe de l'utilisateur, avec leur propre récupération de
compte.

Point important : **WebAuthn ne sert que de porte-clés, pas d'authentification.** Rien
n'est attendu de GoTrue, la session reste une session Supabase ordinaire.

- **Inscription** : compte Supabase comme aujourd'hui. Le front crée une passkey, en tire
  le secret PRF, en dérive une KEK, tire une DEK aléatoire, l'enveloppe, stocke le blob et
  l'identifiant de credential.
- **Connexion** : session Supabase, puis une invite Touch ID / Face ID qui rend le secret
  PRF et déballe la DEK, gardée en mémoire seule.
- **Nouvel appareil** : la passkey s'y est synchronisée, le PRF rend le même secret, ça
  marche sans rien demander. C'est toute la valeur du dispositif.
- **Mot de passe oublié** : non-événement. Le reset Supabase ne touche qu'à la session, la
  DEK n'en dépend pas. En poussant la logique, on peut supprimer le mot de passe et ne
  faire que du lien magique : la question disparaît.

Effet de bord favorable : dériver la KEK du mot de passe aurait une faiblesse théorique,
puisque ce mot de passe transite par GoTrue à chaque connexion. Le secret PRF ne quitte
jamais l'appareil.

### Ce qui reste ouvert

- **Support de `prf`** : large (Safari, Chrome, 1Password) mais pas universel. À vérifier
  par capability check à l'enrôlement, avec une décision explicite pour les navigateurs qui
  ne suivent pas : refuser l'E2E chez eux, ou basculer sur un autre mode. **C'est le point
  à valider avant tout engagement.**
- **Perte de tous les appareils avec une passkey non synchronisée** (clé matérielle,
  appareil hors trousseau) : irréductible. Deux amortisseurs peu coûteux : proposer
  l'enrôlement d'une **seconde passkey** depuis une session ouverte, et prévoir le
  **ré-enveloppement depuis un appareil encore connecté** — ce dernier couvre le scénario
  réel le plus fréquent, où l'utilisateur a oublié son mot de passe mais reste connecté sur
  son téléphone.
- **Bascule des données existantes** : comptes et espaces réels déjà en production (§4).

## 6. Décision

En attente. Les deux issues défendables :

1. **Garder le modèle actuel.** Cohérent, déjà documenté en SPEC §2, parfaitement tenable
   pour une application de productivité personnelle. Discipline associée : debug sur les
   colonnes structurelles (§2), impersonation en dernier recours.
2. **Passer au bout en bout par passkey PRF**, en acceptant le coût du §4 et en ayant
   d'abord validé le support de `prf`.

Ce qu'il ne faut pas : un entre-deux qui ressemble à du bout en bout sans en être — clé
dans le bundle (§3), ou secret « de récupération » détenu par l'opérateur, qui rend la
promesse fausse tout en payant la complexité.
