-- Seed LOCAL uniquement (appliqué par `supabase start` / `supabase db reset`,
-- jamais par `db push`). Pose une clé de chiffrement de développement.
-- En hosted, la clé est créée à la main dans le Vault — voir README.
select vault.create_secret('local-dev-key-not-a-secret', 'clarity_app_key', 'Clé locale de dev')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');

-- « Ma journée » : secret partagé cron → Edge Function, et URL de la fonction
-- vue depuis le conteneur Postgres. Le même secret doit figurer dans
-- `supabase/functions/.env` (CRON_SECRET), voir supabase/functions/README.md.
select vault.create_secret('local-cron-secret-not-a-secret', 'clarity_cron_secret', 'Secret cron local')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_cron_secret');

insert into private.app_config (key, value)
values ('digest_function_url', 'http://host.docker.internal:54321/functions/v1/send-digests')
on conflict (key) do nothing;
