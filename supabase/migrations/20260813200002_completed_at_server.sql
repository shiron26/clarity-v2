-- 0013 — `completed_at` posé par le serveur, plus par le client.
--
-- Jusqu'ici le client envoyait `completed_at: new Date().toISOString()`, soit
-- l'horloge du navigateur. C'est la seule donnée temporelle du produit qui
-- échappait au serveur, en contradiction avec la règle de fuseau unique
-- (SPEC §2) : une horloge locale décalée crédite le mauvais jour dans
-- `objective_week`, puisque `private.credit_day(due_date, completed_at)` en
-- dérive le jour de crédit.
--
-- La correction applique à `completed_at` la doctrine déjà en place pour
-- `completed_by` juste à côté : la valeur du client n'est lue que comme un
-- signal booléen (null = décoché, non-null = coché), l'estampille fait foi
-- côté serveur. Comme pour `completed_by`, elle est assignée à NEW pour que
-- le RETURNING vu par le client reflète ce qui a réellement été stocké.
--
-- Re-cocher une tâche déjà cochée ne redate pas : on conserve l'estampille
-- d'origine, sans quoi une simple réécriture de titre déplacerait le crédit.

create or replace function private.task_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Le WHERE de la vue ne s'applique pas à l'INSERT : revalider le prédicat
    if not (new.user_id = (select auth.uid())
            or (new.space_id is not null and public.is_space_member(new.space_id))) then
      raise exception 'task_write_not_allowed';
    end if;
    if new.assignee_id is not null and not exists (
      select 1 from public.space_member m
      where m.space_id = new.space_id and m.user_id = new.assignee_id and m.left_at is null
    ) then
      raise exception 'task_assignee_not_member';
    end if;
    -- completed_at / completed_by : imposés par le serveur (assignés à NEW pour
    -- que le RETURNING vu par le client reflète la réalité)
    new.completed_at := case when new.completed_at is null then null
                             else now() end;
    new.completed_by := case when new.completed_at is null then null
                             else (select auth.uid()) end;
    insert into private.task
      (user_id, space_id, assignee_id, list_id, objective_id,
       title_enc, description_enc, due_date, is_important, "position", recurrence,
       completed_at, completed_by)
    values
      (new.user_id, new.space_id, new.assignee_id, new.list_id, new.objective_id,
       private.enc(new.title), private.enc(new.description), new.due_date,
       coalesce(new.is_important, false), coalesce(new."position", 0), new.recurrence,
       new.completed_at, new.completed_by)
    returning id, created_at into new.id, new.created_at;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id then
      raise exception 'task_owner_immutable';
    end if;
    if new.assignee_id is not null
       and new.assignee_id is distinct from old.assignee_id
       and not exists (
         select 1 from public.space_member m
         where m.space_id = new.space_id and m.user_id = new.assignee_id and m.left_at is null
       ) then
      raise exception 'task_assignee_not_member';
    end if;
    -- completed_at / completed_by : imposés par le serveur, jamais confiés au
    -- client. Le client ne décide que du null / non-null.
    new.completed_at := case
                          when new.completed_at is null then null
                          when old.completed_at is null then now()
                          else old.completed_at   -- re-cocher ne redate pas
                        end;
    new.completed_by := case
                          when new.completed_at is null then null
                          when old.completed_at is null then (select auth.uid())
                          else old.completed_by
                        end;
    update private.task
    set assignee_id     = new.assignee_id,
        list_id         = new.list_id,
        objective_id    = new.objective_id,
        title_enc       = private.enc(new.title),
        description_enc = private.enc(new.description),
        due_date        = new.due_date,
        is_important    = new.is_important,
        "position"      = new."position",
        recurrence      = new.recurrence,
        completed_at    = new.completed_at,
        completed_by    = new.completed_by
    where id = old.id; -- old vient de la vue → déjà filtré
    return new;
  else
    delete from private.task where id = old.id; -- suppression définitive (pas de corbeille)
    return old;
  end if;
end;
$$;

-- Même trou, même correction, sur les jalons.

create or replace function private.milestone_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_year int;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select o.year into v_year from private.objective o where o.id = old.objective_id;
    if private.is_archived(v_year) then
      raise exception 'milestone_archived_read_only';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_objective_visible(new.objective_id) then
      raise exception 'milestone_write_not_allowed';
    end if;
    select o.year into v_year from private.objective o where o.id = new.objective_id;
    if private.is_archived(v_year) then
      raise exception 'milestone_archived_read_only';
    end if;
    new.completed_at := case when new.completed_at is null then null
                             else now() end;
    new.completed_by := case when new.completed_at is null then null
                             else (select auth.uid()) end;
    insert into private.milestone
      (objective_id, year, quarter, "position", title_enc, completed_at, completed_by)
    values
      (new.objective_id, coalesce(new.year, v_year), new.quarter,
       coalesce(new."position", 0), private.enc(new.title),
       new.completed_at, new.completed_by)
    returning id, created_at into new.id, new.created_at;
    return new;

  elsif tg_op = 'UPDATE' then
    if new.objective_id is distinct from old.objective_id then
      raise exception 'milestone_objective_immutable';
    end if;
    -- Aucun déplacement entre trimestres (SPEC) : on réécrit ailleurs, on ne déplace pas
    if new.quarter is distinct from old.quarter or new.year is distinct from old.year then
      raise exception 'milestone_quarter_immutable';
    end if;
    -- n'importe quel membre coche/décoche → completed_by trace qui
    new.completed_at := case
                          when new.completed_at is null then null
                          when old.completed_at is null then now()
                          else old.completed_at
                        end;
    new.completed_by := case
                          when new.completed_at is null then null
                          when old.completed_at is null then (select auth.uid())
                          else old.completed_by
                        end;
    update private.milestone
    set "position"   = new."position",
        title_enc    = private.enc(new.title),
        completed_at = new.completed_at,
        completed_by = new.completed_by
    where id = old.id;
    return new;

  else
    delete from private.milestone where id = old.id; -- suppression libre, coché ou non
    return old;
  end if;
end;
$$;
