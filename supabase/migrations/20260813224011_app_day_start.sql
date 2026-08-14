-- Début de la journée applicative, en timestamptz.
--
-- Pourquoi le serveur et pas le client : SPEC §5 veut qu'une tâche cochée reste
-- visible, barrée, « jusqu'à la fin du jour ». La borne porte sur completed_at,
-- qui est un timestamptz — la convertir en jour vécu demande le fuseau de
-- l'application, qui vit dans private.app_config et n'est pas lisible par le
-- rôle API. Le front ne peut donc pas la calculer, et l'écrire en dur ferait
-- dériver d'une heure deux fois par an (AGENTS.md : jamais de fuseau en dur).
--
-- app_today() donne déjà la DATE du jour ; celle-ci en donne l'instant de début,
-- le seul comparable à completed_at. Les deux dérivent de private.today(), elles
-- ne peuvent donc pas se contredire.
--
-- `date::timestamp` est minuit en heure murale ; `at time zone <tz>` interprète
-- cette heure murale dans le fuseau de l'app et rend l'instant absolu.

create or replace function public.app_day_start()
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select private.today()::timestamp at time zone private.app_tz()
$$;

revoke all on function public.app_day_start() from public;
revoke all on function public.app_day_start() from anon;
grant execute on function public.app_day_start() to authenticated;
