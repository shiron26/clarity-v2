-- « Ma journée » (SPEC-MA-JOURNEE §5.1) — 6/6 : le déclenchement des résumés.
--
-- Tous les quarts d'heure, pg_cron appelle l'Edge Function `send-digests` via
-- pg_net. Rien de secret ni de propre à un environnement dans cette migration :
--   · l'URL de la fonction vit dans `private.app_config` (clé
--     `digest_function_url`) ;
--   · le secret partagé vit dans le Vault (`clarity_cron_secret`) et voyage
--     dans l'en-tête `x-cron-secret` ; la fonction le compare à son propre
--     secret `CRON_SECRET`.
-- En local, `supabase/seed.sql` pose les deux. En hosted, l'utilisateur les pose
-- à la main (README). Tant que l'un manque, le job ne fait rien : une migration
-- appliquée avant la configuration ne doit pas produire d'erreurs en boucle.
--
-- pg_cron tourne en UTC, mais c'est sans effet ici : le job passe toutes les
-- 15 minutes, et l'heure d'envoi est comparée dans `claim_due_digests`, au
-- fuseau applicatif.

create extension if not exists pg_net;

create or replace function private.dispatch_digests()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url from private.app_config where key = 'digest_function_url';
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'clarity_cron_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.dispatch_digests() from public;
revoke all on function private.dispatch_digests() from anon;
revoke all on function private.dispatch_digests() from authenticated;

select cron.schedule('clarity-send-digests', '*/15 * * * *',
  $$select private.dispatch_digests()$$);
