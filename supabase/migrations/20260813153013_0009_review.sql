-- 0009 — review et review_item : les trois niveaux (semaine, trimestre, année).
--
-- SPEC §3/§4.4 : même table, même mécanique de session, seule la portée change.
-- Tout est librement modifiable après coup, y compris sur objectif archivé
-- (l'archivage gèle l'objet, pas le jugement porté sur lui).
-- L'unicité (owner, period) empêche deux sessions d'espace concurrentes.

create table public.review (
  id                   uuid primary key default gen_random_uuid(),
  period_type          text not null check (period_type in ('week', 'quarter', 'year')),
  period_year          int not null,
  period_index         int,
  user_id              uuid references public.profile (id),
  space_id             uuid references private.space (id),
  validated_at         timestamptz,
  validated_by         uuid references public.profile (id),
  current_objective_id uuid references private.objective (id), -- curseur partagé (uuid en clair, assumé)
  created_by           uuid not null default auth.uid() references public.profile (id),
  created_at           timestamptz not null default now(),

  constraint review_owner_xor check (num_nonnulls(user_id, space_id) = 1),
  constraint review_period_shape check (
    (period_type = 'week' and period_index between 1 and 53)
    or (period_type = 'quarter' and period_index between 1 and 4)
    or (period_type = 'year' and period_index is null)
  )
);

alter table public.review enable row level security;
-- Pas de DELETE : une session de review ne se supprime pas, elle se corrige
revoke all on table public.review from anon, authenticated;
grant select, insert, update on table public.review to authenticated;

-- Unicité par propriétaire (polymorphe → deux index partiels).
-- nulls not distinct : le period_index null du bilan annuel compte comme une valeur.
create unique index review_owner_user_uniq
  on public.review (user_id, period_type, period_year, period_index)
  nulls not distinct
  where user_id is not null;

create unique index review_owner_space_uniq
  on public.review (space_id, period_type, period_year, period_index)
  nulls not distinct
  where space_id is not null;

create policy "review_select"
on public.review for select to authenticated
using (user_id = (select auth.uid())
       or (space_id is not null and public.is_space_member(space_id)));

create policy "review_insert"
on public.review for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (user_id = (select auth.uid())
       or (space_id is not null and public.is_space_member(space_id)))
);

create policy "review_update"
on public.review for update to authenticated
using (user_id = (select auth.uid())
       or (space_id is not null and public.is_space_member(space_id)))
with check (user_id = (select auth.uid())
            or (space_id is not null and public.is_space_member(space_id)));

-- Verrous d'écriture fins : identité immuable, seul celui qui a démarré valide.
create or replace function private.validate_review_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.space_id is distinct from old.space_id
     or new.period_type is distinct from old.period_type
     or new.period_year is distinct from old.period_year
     or new.period_index is distinct from old.period_index
     or new.created_by is distinct from old.created_by then
    raise exception 'review_identity_immutable';
  end if;
  if new.validated_at is distinct from old.validated_at then
    if old.created_by <> (select auth.uid()) then
      raise exception 'review_validate_creator_only';
    end if;
    new.validated_by := case when new.validated_at is null then null
                             else (select auth.uid()) end;
  end if;
  -- le curseur partagé ne pointe que vers un objectif visible de l'appelant
  if new.current_objective_id is not null
     and new.current_objective_id is distinct from old.current_objective_id
     and not public.is_objective_visible(new.current_objective_id) then
    raise exception 'review_cursor_not_visible';
  end if;
  return new;
end;
$$;

create trigger review_validate_update
before update on public.review
for each row execute function private.validate_review_update();

-- ---------------------------------------------------------------------------
-- review_item : chiffré (comment) → table private + vue déchiffrante
-- ---------------------------------------------------------------------------

create table private.review_item (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.review (id) on delete cascade,
  objective_id uuid not null references private.objective (id) on delete cascade,
  rating       smallint check (rating between 1 and 3),
  achieved     boolean,
  comment_enc  bytea,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint review_item_uniq unique (review_id, objective_id)
);

alter table private.review_item enable row level security;

-- Lecture : ma review perso, ou review d'un espace où je suis membre actif.
-- Les commentaires des forks sont ainsi publics dans leur espace (SPEC §4.4),
-- y compris ceux d'un membre parti ; ceux d'un principal perso ne sortent jamais.
create or replace function public.review_item_rows()
returns table (
  id uuid, review_id uuid, objective_id uuid, rating smallint,
  achieved boolean, comment text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select i.id, i.review_id, i.objective_id, i.rating, i.achieved,
         private.dec(i.comment_enc), i.created_at, i.updated_at
  from private.review_item i
  join public.review r on r.id = i.review_id
  where r.user_id = (select auth.uid())
     or (r.space_id is not null and public.is_space_member(r.space_id))
$$;

revoke all on function public.review_item_rows() from public;
revoke all on function public.review_item_rows() from anon;
grant execute on function public.review_item_rows() to authenticated;

create view public.review_item as select * from public.review_item_rows();

revoke all on public.review_item from anon, authenticated;
grant select, insert, update, delete on public.review_item to authenticated;

create or replace function private.review_item_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.review;
  o private.objective;
begin
  if tg_op = 'DELETE' then
    -- ne supprimer que ce qu'on aurait le droit d'écrire
    select * into r from public.review where id = old.review_id;
    if not (r.user_id = (select auth.uid())
            or (r.space_id is not null
                and exists (select 1 from private.objective f
                            where f.id = old.objective_id
                              and f.user_id = (select auth.uid())))) then
      raise exception 'review_item_delete_not_allowed';
    end if;
    delete from private.review_item where id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.review_id is distinct from old.review_id
          or new.objective_id is distinct from old.objective_id) then
    raise exception 'review_item_identity_immutable';
  end if;

  select * into r from public.review where id = new.review_id;
  if not found then
    raise exception 'review_item_review_not_found';
  end if;
  select * into o from private.objective where id = new.objective_id;
  if not found then
    raise exception 'review_item_objective_not_found';
  end if;

  -- Portée (SPEC §4.4) : review perso → mes objectifs non forkés ;
  -- review d'espace → uniquement MES forks d'un principal de CET espace.
  if r.user_id is not null then
    if r.user_id <> (select auth.uid())
       or o.user_id is distinct from (select auth.uid())
       or o.parent_objective_id is not null then
      raise exception 'review_item_scope_personal';
    end if;
  else
    if not public.is_space_member(r.space_id) then
      raise exception 'review_item_not_member';
    end if;
    if o.parent_objective_id is null or o.user_id is distinct from (select auth.uid()) then
      raise exception 'review_item_scope_space: on ne note que ses propres forks';
    end if;
    if (select p.space_id from private.objective p where p.id = o.parent_objective_id)
       is distinct from r.space_id then
      raise exception 'review_item_fork_space_mismatch';
    end if;
  end if;

  -- Saisie selon le niveau : fusées 1–3 en semaine/trimestre, verdict en année
  if r.period_type in ('week', 'quarter') then
    if new.achieved is not null then
      raise exception 'review_item_achieved_year_only';
    end if;
  else
    if new.rating is not null then
      raise exception 'review_item_rating_not_for_year';
    end if;
  end if;

  if new.comment is not null and char_length(new.comment) > 280 then
    raise exception 'review_item_comment_too_long: 280 caractères max';
  end if;

  if tg_op = 'INSERT' then
    insert into private.review_item (review_id, objective_id, rating, achieved, comment_enc)
    values (new.review_id, new.objective_id, new.rating, new.achieved, private.enc(new.comment))
    returning id, created_at, updated_at into new.id, new.created_at, new.updated_at;
  else
    update private.review_item
    set rating      = new.rating,
        achieved    = new.achieved,
        comment_enc = private.enc(new.comment),
        updated_at  = now()
    where id = old.id;
  end if;
  return new;
end;
$$;

create trigger review_item_iiud
instead of insert or update or delete on public.review_item
for each row execute function private.review_item_view_iiud();
