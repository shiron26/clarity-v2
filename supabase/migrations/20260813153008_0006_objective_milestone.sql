-- 0006 — objective et milestone.
--
-- SPEC §3 : trois natures d'objectif (principal, secondaire, fork — le fork est
-- complété en 0007). Le slot est un emplacement FIGÉ : supprimer libère le slot
-- sans décaler les autres, clôturer ne le libère pas (la ligne reste), une
-- création prend le plus petit slot libre. L'archivage est DÉRIVÉ (year < année
-- courante), aucune colonne.

create table private.objective (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profile (id),
  space_id            uuid references private.space (id),
  parent_objective_id uuid references private.objective (id) on delete restrict,
  year                int not null,
  kind                text check (kind in ('principal', 'secondaire')),
  slot                smallint,
  label_enc           bytea not null,
  title_enc           bytea not null,
  why_enc             bytea,
  description_enc     bytea,
  cadence             smallint check (cadence between 1 and 7),
  closed_at           timestamptz,
  created_by          uuid not null references public.profile (id),
  created_at          timestamptz not null default now(),

  constraint objective_owner_xor check (num_nonnulls(user_id, space_id) = 1),

  -- fork ⇔ ni kind ni slot ; sinon les deux sont requis
  constraint objective_fork_shape check (
    (parent_objective_id is null and kind is not null and slot is not null)
    or (parent_objective_id is not null and kind is null and slot is null)
  ),

  -- plages de slots : principal 1–3, secondaire 1–5
  constraint objective_slot_range check (
    slot is null
    or (kind = 'principal' and slot between 1 and 3)
    or (kind = 'secondaire' and slot between 1 and 5)
  ),

  -- cadence obligatoire sur principal perso et fork, interdite partout ailleurs
  constraint objective_cadence_shape check (
    case
      when parent_objective_id is not null then cadence is not null
      when kind = 'principal' and user_id is not null then cadence is not null
      else cadence is null
    end
  )
);

alter table private.objective enable row level security;

-- Unicité des slots, par propriétaire (polymorphe → deux index partiels).
-- Un objectif clôturé garde sa ligne → garde son slot : automatique.
create unique index objective_slot_user_uniq
  on private.objective (user_id, year, kind, slot)
  where user_id is not null and slot is not null;

create unique index objective_slot_space_uniq
  on private.objective (space_id, year, kind, slot)
  where space_id is not null and slot is not null;

create index objective_space_idx on private.objective (space_id);
create index objective_parent_idx on private.objective (parent_objective_id);

-- ---------------------------------------------------------------------------
-- Visibilité d'un objectif — un seul endroit à auditer, réutilisé par la vue,
-- les RLS d'objective_week (0008) et la vue milestone. Étendu aux forks en 0007.
-- ---------------------------------------------------------------------------

create or replace function public.is_objective_visible(p_objective uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.objective o
    where o.id = p_objective
      and (o.user_id = (select auth.uid())
           or (o.space_id is not null and public.is_space_member(o.space_id)))
  )
$$;

revoke all on function public.is_objective_visible(uuid) from public;
revoke all on function public.is_objective_visible(uuid) from anon;
grant execute on function public.is_objective_visible(uuid) to authenticated;

-- Archivage dérivé : year < année courante (fuseau applicatif)
create or replace function private.is_archived(p_year int)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_year < extract(year from private.today())::int
$$;

-- ---------------------------------------------------------------------------
-- Vue déchiffrante public.objective (WHERE étendu aux forks en 0007)
-- ---------------------------------------------------------------------------

create or replace function public.objective_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, parent_objective_id uuid,
  year int, kind text, slot smallint, label text, title text, why text,
  description text, cadence smallint, closed_at timestamptz,
  created_by uuid, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select o.id, o.user_id, o.space_id, o.parent_objective_id, o.year, o.kind, o.slot,
         private.dec(o.label_enc), private.dec(o.title_enc), private.dec(o.why_enc),
         private.dec(o.description_enc), o.cadence, o.closed_at,
         o.created_by, o.created_at
  from private.objective o
  where o.user_id = (select auth.uid())
     or (o.space_id is not null and public.is_space_member(o.space_id))
$$;

revoke all on function public.objective_rows() from public;
revoke all on function public.objective_rows() from anon;
grant execute on function public.objective_rows() to authenticated;

create view public.objective as select * from public.objective_rows();

revoke all on public.objective from anon, authenticated;
grant select, insert, update, delete on public.objective to authenticated;

create or replace function private.objective_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_max_slot smallint;
begin
  if tg_op = 'INSERT' then
    if not (new.user_id = (select auth.uid())
            or (new.space_id is not null and public.is_space_member(new.space_id))) then
      raise exception 'objective_write_not_allowed';
    end if;
    if private.is_archived(new.year) then
      raise exception 'objective_year_archived';
    end if;

    -- Attribution du plus petit slot libre, côté serveur (pas de course possible :
    -- verrou consultatif par propriétaire/année/nature). Les forks n'ont pas de slot.
    if new.parent_objective_id is null and new.slot is null then
      if new.kind is null then
        raise exception 'objective_kind_required';
      end if;
      v_max_slot := case when new.kind = 'principal' then 3 else 5 end;
      perform pg_advisory_xact_lock(hashtextextended(
        coalesce(new.user_id, new.space_id)::text || ':' || new.year || ':' || new.kind, 0));
      select min(s) into new.slot
      from generate_series(1, v_max_slot) s
      where s not in (
        select o.slot from private.objective o
        where o.year = new.year and o.kind = new.kind and o.slot is not null
          and (o.user_id is not distinct from new.user_id)
          and (o.space_id is not distinct from new.space_id)
      );
      if new.slot is null then
        raise exception 'slot_full: aucun slot % libre pour %', new.kind, new.year;
      end if;
    end if;

    insert into private.objective
      (user_id, space_id, parent_objective_id, year, kind, slot,
       label_enc, title_enc, why_enc, description_enc, cadence, closed_at, created_by)
    values
      (new.user_id, new.space_id, new.parent_objective_id, new.year, new.kind, new.slot,
       private.enc(new.label), private.enc(new.title), private.enc(new.why),
       private.enc(new.description), new.cadence, new.closed_at, (select auth.uid()))
    returning id, created_by, created_at into new.id, new.created_by, new.created_at;
    return new;

  elsif tg_op = 'UPDATE' then
    -- Identité figée : seul le contenu, la cadence et la clôture bougent
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id
       or new.parent_objective_id is distinct from old.parent_objective_id
       or new.year is distinct from old.year
       or new.kind is distinct from old.kind
       or new.slot is distinct from old.slot then
      raise exception 'objective_identity_immutable';
    end if;
    if private.is_archived(old.year) then
      raise exception 'objective_archived_read_only';
    end if;
    -- Un fork n'est modifiable que par son auteur (SPEC : il appartient à son auteur)
    if old.parent_objective_id is not null and old.user_id <> (select auth.uid()) then
      raise exception 'fork_owner_only';
    end if;
    update private.objective
    set label_enc       = private.enc(new.label),
        title_enc       = private.enc(new.title),
        why_enc         = private.enc(new.why),
        description_enc = private.enc(new.description),
        cadence         = new.cadence,
        closed_at       = new.closed_at -- « atteint », réversible
    where id = old.id;
    return new;

  else
    if private.is_archived(old.year) then
      raise exception 'objective_archived_read_only';
    end if;
    if old.parent_objective_id is not null and old.user_id <> (select auth.uid()) then
      raise exception 'fork_owner_only';
    end if;
    -- Un objectif d'espace forké est protégé par le ON DELETE RESTRICT :
    -- chaque membre doit d'abord supprimer son fork.
    delete from private.objective where id = old.id;
    return old;
  end if;
end;
$$;

create trigger objective_iiud
instead of insert or update or delete on public.objective
for each row execute function private.objective_view_iiud();

-- ---------------------------------------------------------------------------
-- milestone — titre seul, max 4 par (objectif, année, trimestre), jamais sur un fork
-- ---------------------------------------------------------------------------

create table private.milestone (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references private.objective (id) on delete cascade,
  year         int not null,
  quarter      smallint not null check (quarter between 1 and 4),
  "position"   int not null default 0,
  title_enc    bytea not null,
  completed_at timestamptz,
  completed_by uuid references public.profile (id),
  created_at   timestamptz not null default now()
);

alter table private.milestone enable row level security;

create index milestone_objective_idx on private.milestone (objective_id, year, quarter);

-- Jamais sur un fork ; l'année du jalon est celle de l'objectif ;
-- max 4 par trimestre (FOR UPDATE sur l'objectif : sérialise les créations).
create or replace function private.validate_milestone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  o private.objective;
begin
  select * into o from private.objective where id = new.objective_id for update;
  if not found then
    raise exception 'milestone_objective_not_found';
  end if;
  if o.parent_objective_id is not null then
    raise exception 'milestone_on_fork_not_allowed';
  end if;
  if new.year <> o.year then
    raise exception 'milestone_year_mismatch';
  end if;
  if tg_op = 'INSERT'
     or new.objective_id is distinct from old.objective_id
     or new.quarter is distinct from old.quarter then
    if (select count(*)
        from private.milestone m
        where m.objective_id = new.objective_id
          and m.year = new.year
          and m.quarter = new.quarter
          and m.id <> new.id) >= 4 then
      raise exception 'milestone_cap: max 4 jalons par trimestre';
    end if;
  end if;
  return new;
end;
$$;

create trigger milestone_validate
before insert or update on private.milestone
for each row execute function private.validate_milestone();

create or replace function public.milestone_rows()
returns table (
  id uuid, objective_id uuid, year int, quarter smallint, "position" int,
  title text, completed_at timestamptz, completed_by uuid, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select m.id, m.objective_id, m.year, m.quarter, m."position",
         private.dec(m.title_enc), m.completed_at, m.completed_by, m.created_at
  from private.milestone m
  where public.is_objective_visible(m.objective_id)
$$;

revoke all on function public.milestone_rows() from public;
revoke all on function public.milestone_rows() from anon;
grant execute on function public.milestone_rows() to authenticated;

create view public.milestone as select * from public.milestone_rows();

revoke all on public.milestone from anon, authenticated;
grant select, insert, update, delete on public.milestone to authenticated;

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

create trigger milestone_iiud
instead of insert or update or delete on public.milestone
for each row execute function private.milestone_view_iiud();

-- ---------------------------------------------------------------------------
-- task.objective_id : FK différée depuis 0004 + validation de nature.
-- Cible autorisée : principal PERSO ou fork — jamais un secondaire ni un
-- objectif d'espace. Tâche perso → son propre objectif. Tâche d'espace → le
-- fork de CELUI QUI RATTACHE, fork d'un principal de CE space.
-- ---------------------------------------------------------------------------

alter table private.task
  add constraint task_objective_fk
  foreign key (objective_id) references private.objective (id) on delete set null;

create or replace function private.validate_task_objective()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  o private.objective;
  v_parent_space uuid;
begin
  -- Écritures système (ex. génération d'une occurrence récurrente en 0008) :
  -- l'objective_id est recopié tel quel, le cocheur n'est pas forcément le
  -- propriétaire du fork — on ne revalide pas.
  if coalesce(current_setting('clarity.system_write', true), '') = 'on' then
    return new;
  end if;
  if new.objective_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.objective_id is not distinct from old.objective_id then
    return new;
  end if;

  select * into o from private.objective where id = new.objective_id;
  if not found then
    raise exception 'task_objective_not_found';
  end if;

  if not ((o.user_id is not null and o.kind = 'principal') or o.parent_objective_id is not null) then
    raise exception 'task_objective_invalid_target: principal perso ou fork uniquement';
  end if;

  if new.user_id is not null then
    -- tâche perso : l'objectif (principal ou fork) doit appartenir au même user
    if o.user_id is distinct from new.user_id then
      raise exception 'task_objective_owner_mismatch';
    end if;
  else
    -- tâche d'espace : uniquement le fork de celui qui rattache, dans ce space
    if o.parent_objective_id is null then
      raise exception 'task_objective_space_requires_fork';
    end if;
    if o.user_id is distinct from (select auth.uid()) then
      raise exception 'task_objective_fork_owner_only';
    end if;
    select p.space_id into v_parent_space
    from private.objective p where p.id = o.parent_objective_id;
    if v_parent_space is distinct from new.space_id then
      raise exception 'task_objective_fork_space_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create trigger task_validate_objective
before insert or update on private.task
for each row execute function private.validate_task_objective();
