-- 0005 — RPC de la vue Tâches.
--
-- Les 6 vues (Aujourd'hui, Demain, Cette semaine, En retard, Toutes, Par liste)
-- sont des prédicats CLIENT sur public.task — voir README. Rien à créer côté SQL.
--
-- SPEC §5 : le report en masse est la seule action groupée du produit.
-- L'exclusion des tâches d'espace est délibérée : une action personnelle ne doit
-- jamais modifier des données collectives sans que les autres le sachent.

create or replace function public.postpone_overdue_tasks()
returns integer
language sql security definer
set search_path = ''
as $$
  with moved as (
    update private.task
    set due_date = private.today()
    where user_id = (select auth.uid())
      and due_date < private.today()
      and completed_at is null
      and space_id is null -- jamais de tâche partagée
    returning 1
  )
  select count(*)::integer from moved
$$;

revoke all on function public.postpone_overdue_tasks() from public;
revoke all on function public.postpone_overdue_tasks() from anon;
grant execute on function public.postpone_overdue_tasks() to authenticated;
