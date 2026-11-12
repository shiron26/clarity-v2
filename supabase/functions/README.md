# Edge Functions

## `send-digests` : les résumés « Ma journée » (SPEC-MA-JOURNEE §5)

Appelée tous les quarts d'heure par pg_cron (`private.dispatch_digests`, via pg_net, en-tête
`x-cron-secret`), ou par l'utilisateur avec son JWT et `{ "test": true }` (notification de
test des réglages). `verify_jwt = false` dans `config.toml` : la fonction vérifie elle-même
le secret ou le jeton.

### Secrets

| Secret | Rôle |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | paire Web Push (`npx web-push@3.6.7 generate-vapid-keys`). La publique va AUSSI dans `VITE_VAPID_PUBLIC_KEY` du front. |
| `VAPID_SUBJECT` | `mailto:<adresse réelle>` ou `https://<site>`. **Apple refuse (403 `BadJwtToken`) un domaine non routable** comme `mailto:…@clarity.local`. |
| `CRON_SECRET` | doit être égal au secret Vault `clarity_cron_secret` |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés par le runtime.

### En local

`supabase/functions/.env` (gitignoré) porte les quatre secrets ; `supabase/seed.sql` pose le
secret Vault `local-cron-secret-not-a-secret` et l'URL de la fonction vue depuis Postgres.

```sh
npx supabase functions serve --env-file supabase/functions/.env
curl -X POST http://127.0.0.1:54321/functions/v1/send-digests \
  -H 'x-cron-secret: local-cron-secret-not-a-secret'
```

Le push réel exige HTTPS de bout en bout : pour une notification sur iPhone, servir
`npm run build && npm run preview` derrière un tunnel HTTPS, avec `VITE_VAPID_PUBLIC_KEY`.

### En hosted : à faire par l'utilisateur, jamais par un agent

```sql
-- SQL editor du dashboard
select vault.create_secret('<openssl rand -base64 32>', 'clarity_cron_secret', 'Secret cron → send-digests');
insert into private.app_config (key, value)
values ('digest_function_url', 'https://<ref>.supabase.co/functions/v1/send-digests');
```

```sh
npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=<le même>
npx supabase functions deploy send-digests
```

Puis `VITE_VAPID_PUBLIC_KEY` dans les variables du déploiement front.
