-- Seed LOCAL uniquement (appliqué par `supabase start` / `supabase db reset`,
-- jamais par `db push`). Pose une clé de chiffrement de développement.
-- En hosted, la clé est créée à la main dans le Vault — voir README.
select vault.create_secret('local-dev-key-not-a-secret', 'clarity_app_key', 'Clé locale de dev')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');
