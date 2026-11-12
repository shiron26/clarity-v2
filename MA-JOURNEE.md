# « Ma journée » : résumé quotidien et notifications

*En production depuis le 2026-11-12. Ce document décrit la feature de bout en bout :
ce qu'elle fait, comment les pièces s'enchaînent, et comment l'exploiter. Les règles
d'architecture qui ne se négocient pas vivent dans [AGENTS.md](./AGENTS.md) ; les
procédures détaillées dans [supabase/functions/README.md](./supabase/functions/README.md)
(Edge Function, secrets) et [scripts/apps-script/README.md](./scripts/apps-script/README.md)
(collecteur Google).*

## 1. Ce que voit l'utilisateur

- **Chaque matin** (07:30 par défaut, réglable au quart d'heure), une notification
  « ☀️ Votre journée » résume : tâches du jour et en retard, rendez-vous, mails non lus,
  anniversaires. La pastille de l'icône affiche le nombre de tâches restantes.
- **Un tap** ouvre `/ma-journee`, dans cet ordre : anniversaires (avec « Lui écrire »,
  au choix WhatsApp ou Messages), rendez-vous (aujourd'hui et demain), tâches (cochables,
  les tâches cochées du jour restent visibles), mails importants puis autres mails. Une
  section vide n'est pas affichée.
- **Sur le dashboard**, un bouton coloré au-dessus des objectifs mène à la journée ; il
  s'éteint une fois la journée consultée.
- **Réglages** (`/ma-journee/reglages`) : notifications par appareil et notification de
  test, heure d'envoi, modèle du message d'anniversaire, jetons de synchronisation Google.

## 2. Le parcours des données

```
Google (Gmail, Agenda, Contacts)
   │  Apps Script du compte, toutes les heures
   ▼
public.ingest_daily_snapshot(jeton, payload)      ← seule fonction accessible en anon
   │  chiffre et stocke dans private.*
   ▼
Postgres ──── pg_cron */15 ──► private.dispatch_digests()
                                  │ pg_net + x-cron-secret
                                  ▼
                       Edge Function send-digests
                         claim_due_digests() → Web Push (VAPID)
                                  │
                                  ▼
                 Apple / FCM / Mozilla → service worker (src/sw.ts)
                                  │ tap
                                  ▼
                       /ma-journee → public.get_my_day() + useTasks
```

### Collecte (Apps Script)

Un script par compte Google (`scripts/apps-script/Code.gs`), déclencheur horaire. Il
envoie la fenêtre d'agenda des deux prochains jours, les 15 derniers mails non lus de la
boîte principale (`in:inbox category:primary is:unread newer_than:2d`, avec le marqueur
« important » de Gmail), et les anniversaires (Contacts + agendas « Anniversaires » /
« Birthdays »). Les agendas fournis par Google (numéros de semaine, jours fériés) sont
ignorés. `diagnoseCalendars` et `diagnoseEmails` aident quand rien n'apparaît.

### Ingestion

`ingest_daily_snapshot` authentifie par un **jeton haché** (sha256, jamais stocké en clair,
3 actifs maximum par compte), valide tout le payload et le rejette à la première règle
violée. Les rendez-vous de la fenêtre et les mails sont remplacés ; les anniversaires ne
sont réécrits que s'ils ont changé (empreinte HMAC). Les anniversaires saisis à la main
(`source = 'manual'`) ne sont jamais touchés.

### Lecture

`get_my_day(date)` rend la synchro (périmée au-delà de 26 h), les rendez-vous
aujourd'hui / demain avec heures formatées par le serveur, les mails, et les
anniversaires (le 29 février se fête le 28 les années non bissextiles), message
pré-rempli compris. **Les tâches n'en font pas partie** : l'écran les lit par `useTasks`,
avec la même règle que la vue « Aujourd'hui » (`src/lib/taskDay.ts`).

### Envoi

Tous les quarts d'heure, `claim_due_digests()` sélectionne les comptes dont l'heure est
passée (rattrapage jusqu'à 6 h) et pose `last_sent_on` **avant** l'envoi : un seul
résumé par jour, au prix d'un envoi raté non retenté. L'Edge Function envoie en
parallèle (10 à la fois), puis marque les abonnements réussis et supprime ceux que le
service push déclare morts (404 / 410).

## 3. Sécurité

- **Une seule surface `anon`** : l'ingestion. Erreur volontairement générique
  (`invalid token`).
- **Tout est chiffré** comme le reste de Clarity (pgcrypto + clé Vault), selon le pattern
  table `private` + `_rows()` + vue `public`.
- **Les fonctions d'envoi sont réservées à `service_role`** : elles lisent les abonnements
  de tout le monde.
- **Les endpoints push sont restreints** aux services des navigateurs (Apple, FCM,
  Mozilla, Windows), sinon l'Edge Function deviendrait un relais de requêtes.
- **Aucune donnée en cache** : le service worker ne met jamais une réponse de l'API en
  Cache Storage.

## 4. Exploitation

### Où vivent les secrets

| Secret | Où | Faut-il le garder ? |
|---|---|---|
| Secret cron | Vault `clarity_cron_secret` **et** secret de fonction `CRON_SECRET` (identiques) | Non : se régénère à volonté (§4.2) |
| Clé VAPID privée | secret de fonction `VAPID_PRIVATE_KEY` | **Oui, gestionnaire de mots de passe** : la perdre oblige à changer de paire, et tous les appareils doivent réactiver les notifications |
| Clé VAPID publique | `VAPID_PUBLIC_KEY` + `VITE_VAPID_PUBLIC_KEY` (Vercel) | Avec la privée. Elle n'est pas secrète |
| `VAPID_SUBJECT` | secret de fonction | `mailto:` réel ou `https://`. Apple refuse un domaine non routable |
| Jeton d'ingestion | propriétés du script Google | Non : en générer un nouveau dans les réglages et révoquer l'ancien |

`VITE_VAPID_PUBLIC_KEY` est intégrée **au build** : la changer sur Vercel exige un
redéploiement.

### Changer le secret cron

```bash
NEW=$(openssl rand -hex 32)
npx supabase secrets set CRON_SECRET=$NEW
```

```sql
-- SQL editor, avec la même valeur
select vault.update_secret(
  (select id from vault.secrets where name = 'clarity_cron_secret'),
  '<la même valeur>'
);
```

Deux valeurs différentes = la fonction répond 401 et plus rien ne part.

### Brancher un nouvel utilisateur

1. Il installe la PWA (iPhone : Safari → Partager → Sur l'écran d'accueil, iOS 16.4+) et
   active les notifications depuis **l'app installée**, pas un onglet Safari.
2. Il génère un jeton dans Réglages → Synchronisation Google.
3. Il installe le script sur son compte Google : [scripts/apps-script/README.md](./scripts/apps-script/README.md).

### Dépannage

| Symptôme | Cause probable |
|---|---|
| « Ce navigateur ne reçoit pas de notification » | Ouvert dans Safari au lieu de l'app installée, ou build sans `VITE_VAPID_PUBLIC_KEY` |
| La notification de test ne part pas, 403 `BadJwtToken` dans les logs | `VAPID_SUBJECT` non routable |
| Pas de résumé le matin | Secret cron différent aux deux endroits, `digest_function_url` absente de `private.app_config`, ou notifications désactivées dans les réglages |
| « Synchronisation en retard » sur l'écran | Le script Google n'a rien envoyé depuis 26 h (jeton révoqué, déclencheur supprimé) |
| Rien ne s'affiche après une synchro | Lancer `diagnoseCalendars` / `diagnoseEmails` dans le script |

Les logs de l'Edge Function (dashboard Supabase → Edge Functions → `send-digests`)
donnent le motif de refus de chaque service push.

## 5. Le code

| Zone | Fichiers |
|---|---|
| Base | `supabase/migrations/20261112090{0..5}00_day_*.sql` (jetons, sources, ingestion, lecture, push, cron) |
| Envoi | `supabase/functions/send-digests/index.ts` |
| Collecte | `scripts/apps-script/Code.gs`, `appsscript.json` |
| Service worker | `src/sw.ts`, `src/lib/pushMessages.ts` |
| Abonnement push | `src/lib/push.ts`, `src/hooks/usePushBridge.ts` |
| Écrans | `src/features/day/` (`MyDayPage`, `DaySettingsPage`, `useDay.ts`) |
| Dashboard | `src/features/home/components/MyDayButton.tsx`, `src/hooks/useDigestSettings.ts` |
| Partagé | `src/hooks/useTaskCompletion.ts`, `src/lib/taskDay.ts`, `src/lib/messageLinks.ts` |

### Tests

- `supabase/tests/04_ma_journee.sql` : jetons, surface anon, ingestion idempotente,
  étanchéité entre comptes, 29 février, texte du résumé, un seul envoi par jour.
- Vitest : `src/lib/dayPure.test.ts`, `src/lib/relativeTime.test.ts`.
- Playwright : `e2e/specs/15-ma-journee.spec.ts` (données préparées par l'API, mails,
  « Lui écrire », tâche cochée toujours visible après rechargement).

## 6. Limites connues et suite

- Un envoi qui échoue après le « claim » n'est pas retenté le jour même.
- Le fuseau est unique pour tous (`private.app_tz()`).
- Pas encore d'interface pour saisir un anniversaire à la main (la vue `birthday` l'accepte
  déjà côté base).
- Le push n'existe sur iPhone que dans la PWA installée.
