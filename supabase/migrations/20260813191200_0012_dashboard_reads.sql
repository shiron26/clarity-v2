-- 0012 — deux lectures dont le dashboard a besoin. Rien n'est stocké ici.
--
-- Le point commun des deux : ce sont des règles serveur (fuseau de l'app, jour
-- crédité) que le front ne doit pas réimplémenter, sous peine de dériver dès que
-- la règle bouge. On les expose plutôt que de les recopier en TypeScript.

-- ---------------------------------------------------------------------------
-- « Aujourd'hui » dans le fuseau de l'application.
--
-- Les six vues de la page Tâches sont des prédicats CLIENT sur due_date (0005),
-- mais private.app_tz() / private.today() ne sont pas accessibles au rôle API —
-- et le fuseau ne doit jamais être écrit en dur (SPEC §2). Sans ce point d'ancrage,
-- un utilisateur hors Europe/Paris verrait « Aujourd'hui » dériver d'un jour.
-- ---------------------------------------------------------------------------

create or replace function public.app_today()
returns date
language sql stable security definer
set search_path = ''
as $$
  select private.today()
$$;

revoke all on function public.app_today() from public;
revoke all on function public.app_today() from anon;
grant execute on function public.app_today() to authenticated;

-- ---------------------------------------------------------------------------
-- Jours crédités par objectif sur une période (heatmap trimestrielle).
--
-- objective_week ne stocke qu'un compteur par semaine : le détail jour par jour
-- n'existe nulle part. Il est reconstruit ici avec EXACTEMENT la formule que
-- private.refresh_objective_week() agrège (SPEC §4.1), donc les deux ne peuvent
-- pas se contredire — contrairement à une seconde table dérivée.
--
-- La visibilité est évaluée une fois par objectif (et non par tâche) : la CTE
-- borne le nombre d'appels à is_objective_visible à la taille du tableau.
-- ---------------------------------------------------------------------------

create or replace function public.objective_active_days(
  p_objectives uuid[],
  p_from date,
  p_to date
)
returns table (objective_id uuid, day date)
language sql stable security definer
set search_path = ''
as $$
  with visible as (
    select o.id
    from unnest(p_objectives) as o (id)
    where public.is_objective_visible(o.id)
  )
  select distinct t.objective_id,
         private.credit_day(t.due_date, t.completed_at)
  from private.task t
  join visible v on v.id = t.objective_id
  where t.completed_at is not null
    and private.credit_day(t.due_date, t.completed_at) between p_from and p_to
$$;

revoke all on function public.objective_active_days(uuid[], date, date) from public;
revoke all on function public.objective_active_days(uuid[], date, date) from anon;
grant execute on function public.objective_active_days(uuid[], date, date) to authenticated;
