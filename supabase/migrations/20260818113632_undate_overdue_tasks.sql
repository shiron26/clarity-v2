-- Jumelle de `postpone_overdue_tasks` (migration 0005) : sortir les tâches en
-- retard du calendrier au lieu de les reporter à aujourd'hui.
--
-- Reporter à aujourd'hui suppose qu'on va s'en occuper aujourd'hui. Une pile de
-- tâches en retard contient surtout des choses qu'on fera « un jour » : les
-- pousser d'un jour recrée le même retard demain, et la seule issue honnête est
-- de leur retirer leur date. Elles rejoignent la vue « Sans date », qui existe
-- déjà côté client (prédicat sur `due_date is null`, voir README).
--
-- Mêmes garde-fous que la jumelle, à la ligne près :
--   * `user_id = auth.uid()` — on ne touche qu'à ses propres tâches ;
--   * `space_id is null` — une action personnelle ne modifie jamais des données
--     collectives sans que les autres membres le sachent ;
--   * `completed_at is null` — une tâche déjà cochée n'est pas en retard.
--
-- `security definer` + `set search_path = ''` + objets qualifiés : le WHERE de
-- la fonction EST la sécurité.

create or replace function public.undate_overdue_tasks()
returns integer
language sql security definer
set search_path = ''
as $$
  with cleared as (
    update private.task
    set due_date = null
    where user_id = (select auth.uid())
      and due_date < private.today()
      and completed_at is null
      and space_id is null -- jamais de tâche partagée
    returning 1
  )
  select count(*)::integer from cleared
$$;

revoke all on function public.undate_overdue_tasks() from public;
revoke all on function public.undate_overdue_tasks() from anon;
grant execute on function public.undate_overdue_tasks() to authenticated;

comment on function public.undate_overdue_tasks() is
  'Retire leur date aux tâches personnelles en retard : elles passent dans « Sans date ». Rend le nombre de lignes touchées.';
