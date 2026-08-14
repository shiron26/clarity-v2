-- 0007 — Forks et objectifs d'espace.
--
-- SPEC §3 : un membre peut forker un objectif PRINCIPAL d'espace (jamais un
-- secondaire) pour en faire un objectif personnel avec son propre rythme.
-- Un fork par membre et par objectif ; il ne consomme aucun slot, ne porte pas
-- de kind, appartient à son auteur. La suppression du parent est bloquée tant
-- qu'il existe des forks (on delete restrict, déjà posé en 0006).

-- Un fork par membre et par objectif d'espace
create unique index objective_fork_uniq
  on private.objective (parent_objective_id, user_id)
  where parent_objective_id is not null;

-- ---------------------------------------------------------------------------
-- Validation de la forme d'un fork (BEFORE sur la table de base : couvre
-- toutes les écritures, y compris futures RPC)
-- ---------------------------------------------------------------------------

create or replace function private.validate_fork()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p private.objective;
begin
  if new.parent_objective_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.parent_objective_id is not distinct from old.parent_objective_id then
    return new;
  end if;

  select * into p from private.objective where id = new.parent_objective_id;
  if not found then
    raise exception 'fork_parent_not_found';
  end if;
  if p.space_id is null or p.kind <> 'principal' then
    raise exception 'fork_parent_must_be_space_principal';
  end if;
  if p.parent_objective_id is not null then
    raise exception 'fork_of_fork_not_allowed';
  end if;
  if new.user_id is null then
    raise exception 'fork_must_be_personal';
  end if;
  if new.year <> p.year then
    raise exception 'fork_year_mismatch';
  end if;
  if not exists (
    select 1 from public.space_member m
    where m.space_id = p.space_id and m.user_id = new.user_id and m.left_at is null
  ) then
    raise exception 'fork_author_not_member';
  end if;
  return new;
end;
$$;

create trigger objective_validate_fork
before insert or update on private.objective
for each row execute function private.validate_fork();

-- ---------------------------------------------------------------------------
-- Visibilité étendue : les forks des co-membres sont visibles dans l'espace
-- (nécessaire pour l'état hebdo déduit et les reviews d'espace).
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
           or (o.space_id is not null and public.is_space_member(o.space_id))
           or (o.parent_objective_id is not null and exists (
                 select 1 from private.objective p
                 where p.id = o.parent_objective_id
                   and p.space_id is not null
                   and public.is_space_member(p.space_id))))
  )
$$;

-- create or replace conserve les grants existants ; la vue public.objective
-- (select * from objective_rows()) n'a pas besoin de changer
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
     or (o.parent_objective_id is not null and exists (
           select 1 from private.objective p
           where p.id = o.parent_objective_id
             and p.space_id is not null
             and public.is_space_member(p.space_id)))
$$;

-- ---------------------------------------------------------------------------
-- État hebdomadaire déduit d'un objectif d'espace (SPEC §4.2).
-- Aucun stockage : source de vérité = les objective_week des forks (0008).
-- tenu = une majorité des membres ayant forké a atteint sa cadence.
-- ---------------------------------------------------------------------------

create or replace function public.space_objective_weekly_state(
  p_objective uuid, p_iso_year int, p_iso_week int)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_forks int;
  v_met   int;
begin
  -- Autorisation : l'appelant doit être membre actif de l'espace de l'objectif
  if not exists (
    select 1 from private.objective o
    where o.id = p_objective
      and o.space_id is not null
      and public.is_space_member(o.space_id)
  ) then
    return null;
  end if;

  select count(*),
         count(*) filter (where w.active_days >= w.cadence_target)
  into v_forks, v_met
  from private.objective f
  left join public.objective_week w
    on w.objective_id = f.id
   and w.iso_year = p_iso_year
   and w.iso_week = p_iso_week
  where f.parent_objective_id = p_objective;

  if v_forks = 0 then
    return 'non_evalue'; -- ni réussite ni échec au bilan annuel
  elsif v_met * 2 > v_forks then
    return 'tenu';
  else
    return 'non_tenu';
  end if;
end;
$$;

revoke all on function public.space_objective_weekly_state(uuid, int, int) from public;
revoke all on function public.space_objective_weekly_state(uuid, int, int) from anon;
grant execute on function public.space_objective_weekly_state(uuid, int, int) to authenticated;
