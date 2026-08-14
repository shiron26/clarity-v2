-- 0004 — list et task : la boucle de base.
--
-- SPEC §3 : une tâche est faite ou pas faite (pas de statut, pas de Kanban),
-- drapeau is_important, suppression définitive. space_id est une colonne PROPRE
-- à la tâche, jamais déduite de list.space_id. Supprimer une liste DÉTACHE ses
-- tâches (on delete set null). due_date : date seule, sans heure (décision actée).

-- ---------------------------------------------------------------------------
-- Tables chiffrées
-- ---------------------------------------------------------------------------

create table private.list (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profile (id),
  space_id   uuid references private.space (id),
  name_enc   bytea not null,
  color      text,
  "position" int not null default 0,
  created_at timestamptz not null default now(),
  -- XOR canonique : un objet appartient soit à un utilisateur, soit à un espace
  constraint list_owner_xor check (num_nonnulls(user_id, space_id) = 1)
);

alter table private.list enable row level security;

create table private.task (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profile (id),
  space_id        uuid references private.space (id),
  assignee_id     uuid references public.profile (id),
  list_id         uuid references private.list (id) on delete set null,
  objective_id    uuid, -- FK + validation de nature en 0006
  title_enc       bytea not null,
  description_enc bytea,
  due_date        date,
  is_important    boolean not null default false,
  "position"      int not null default 0,
  recurrence      jsonb,
  completed_at    timestamptz,
  completed_by    uuid references public.profile (id),
  created_at      timestamptz not null default now(),
  constraint task_owner_xor check (num_nonnulls(user_id, space_id) = 1),
  constraint task_assignee_space_only check (assignee_id is null or space_id is not null)
);

alter table private.task enable row level security;

create index task_user_due_idx on private.task (user_id, due_date);
create index task_space_due_idx on private.task (space_id, due_date);
create index task_list_idx on private.task (list_id);
create index task_objective_idx on private.task (objective_id);
create index task_user_open_idx on private.task (user_id) where completed_at is null;

-- ---------------------------------------------------------------------------
-- Cohérence tâche ↔ liste : une tâche vit dans une liste du même propriétaire
-- (même user OU même space). Vérifiée à l'écriture ; le détachement par
-- suppression de liste (set null) ne repasse pas par ici.
-- ---------------------------------------------------------------------------

create or replace function private.validate_task_list()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  l private.list;
begin
  if new.list_id is not null
     and (tg_op = 'INSERT' or new.list_id is distinct from old.list_id
          or new.user_id is distinct from old.user_id
          or new.space_id is distinct from old.space_id) then
    select * into l from private.list where id = new.list_id;
    if not found then
      raise exception 'task_list_not_found';
    end if;
    if l.user_id is distinct from new.user_id
       or l.space_id is distinct from new.space_id then
      raise exception 'task_list_owner_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger task_validate_list
before insert or update on private.task
for each row execute function private.validate_task_list();

-- ---------------------------------------------------------------------------
-- Vue déchiffrante public.list
-- Gestion des listes d'espace accessible à tout membre (mêmes droits pour tous).
-- ---------------------------------------------------------------------------

-- Fonction SECURITY DEFINER : déchiffrement + prédicat (voir 0003 pour le pourquoi)
create or replace function public.list_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, name text, color text,
  "position" int, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.user_id, l.space_id, private.dec(l.name_enc), l.color,
         l."position", l.created_at
  from private.list l
  where l.user_id = (select auth.uid())
     or (l.space_id is not null and public.is_space_member(l.space_id))
$$;

revoke all on function public.list_rows() from public;
revoke all on function public.list_rows() from anon;
grant execute on function public.list_rows() to authenticated;

create view public.list as select * from public.list_rows();

revoke all on public.list from anon, authenticated;
grant select, insert, update, delete on public.list to authenticated;

create or replace function private.list_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not (new.user_id = (select auth.uid())
            or (new.space_id is not null and public.is_space_member(new.space_id))) then
      raise exception 'list_write_not_allowed';
    end if;
    insert into private.list (user_id, space_id, name_enc, color, "position")
    values (new.user_id, new.space_id, private.enc(new.name), new.color,
            coalesce(new."position", 0))
    returning id, created_at into new.id, new.created_at;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id then
      raise exception 'list_owner_immutable';
    end if;
    update private.list
    set name_enc   = private.enc(new.name),
        color      = new.color,
        "position" = new."position"
    where id = old.id;
    return new;
  else
    delete from private.list where id = old.id; -- les tâches sont détachées (set null)
    return old;
  end if;
end;
$$;

create trigger list_iiud
instead of insert or update or delete on public.list
for each row execute function private.list_view_iiud();

-- ---------------------------------------------------------------------------
-- Vue déchiffrante public.task — LE pattern de référence du produit
-- ---------------------------------------------------------------------------

create or replace function public.task_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, assignee_id uuid, list_id uuid,
  objective_id uuid, title text, description text, due_date date,
  is_important boolean, "position" int, recurrence jsonb,
  completed_at timestamptz, completed_by uuid, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select t.id, t.user_id, t.space_id, t.assignee_id, t.list_id, t.objective_id,
         private.dec(t.title_enc), private.dec(t.description_enc), t.due_date,
         t.is_important, t."position", t.recurrence,
         t.completed_at, t.completed_by, t.created_at
  from private.task t
  where t.user_id = (select auth.uid())
     or (t.space_id is not null and public.is_space_member(t.space_id))
$$;

revoke all on function public.task_rows() from public;
revoke all on function public.task_rows() from anon;
grant execute on function public.task_rows() to authenticated;

create view public.task as select * from public.task_rows();

revoke all on public.task from anon, authenticated;
grant select, insert, update, delete on public.task to authenticated;

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
    -- completed_by : imposé par le serveur (assigné à NEW pour que le
    -- RETURNING vu par le client reflète la réalité)
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
    -- completed_by : imposé par le serveur, jamais confié au client
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

create trigger task_iiud
instead of insert or update or delete on public.task
for each row execute function private.task_view_iiud();
