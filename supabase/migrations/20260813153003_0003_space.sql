-- 0003 — space, space_member, space_invitation + le helper transverse is_space_member.
--
-- SPEC §3 : pas de propriétaire ni de rôle — tous les membres ont les mêmes droits.
-- Max 4 membres actifs. Un membre parti (left_at) perd tout accès ; ses productions
-- restent visibles des membres restants (lecture seule émergente).
-- Un espace vidé de ses membres est conservé mais devient inaccessible (pas de delete).

-- ---------------------------------------------------------------------------
-- Table chiffrée : private.space
-- ---------------------------------------------------------------------------

create table private.space (
  id         uuid primary key default gen_random_uuid(),
  name_enc   bytea not null,
  color      text,
  created_at timestamptz not null default now()
);

alter table private.space enable row level security; -- verrou dormant, aucune policy

-- ---------------------------------------------------------------------------
-- Table claire : public.space_member
-- ---------------------------------------------------------------------------

create table public.space_member (
  space_id  uuid not null references private.space (id),
  user_id   uuid not null references public.profile (id),
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (space_id, user_id)
);

alter table public.space_member enable row level security;

-- Quitter un espace = poser son propre left_at ; rien d'autre n'est modifiable.
-- L'insertion passera par le flux d'invitation (RPC future, SPEC §7) ou par la
-- création d'espace (trigger INSTEAD OF ci-dessous, en definer).
revoke all on table public.space_member from anon, authenticated;
grant select on table public.space_member to authenticated;
grant update (left_at) on table public.space_member to authenticated;

-- ---------------------------------------------------------------------------
-- LE helper d'autorisation transverse (un seul endroit à auditer).
-- SECURITY DEFINER : casse la récursion RLS de space_member sur elle-même.
-- ---------------------------------------------------------------------------

create or replace function public.is_space_member(p_space uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_member m
    where m.space_id = p_space
      and m.user_id = (select auth.uid())
      and m.left_at is null
  )
$$;

revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.is_space_member(uuid) from anon;
grant execute on function public.is_space_member(uuid) to authenticated;

create policy "space_member_select_members"
on public.space_member for select to authenticated
using (public.is_space_member(space_id));

create policy "space_member_leave"
on public.space_member for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Max 4 membres actifs — contrainte inter-lignes, impossible en CHECK.
-- FOR UPDATE sur la ligne space : sérialise deux arrivées simultanées.
-- ---------------------------------------------------------------------------

create or replace function private.enforce_member_cap()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.left_at is null and (tg_op = 'INSERT' or old.left_at is not null) then
    perform 1 from private.space s where s.id = new.space_id for update;
    if (select count(*)
        from public.space_member m
        where m.space_id = new.space_id
          and m.left_at is null
          and m.user_id <> new.user_id) >= 4 then
      raise exception 'space_member_cap: max 4 membres actifs par espace';
    end if;
  end if;
  return new;
end;
$$;

create trigger space_member_cap
before insert or update on public.space_member
for each row execute function private.enforce_member_cap();

-- ---------------------------------------------------------------------------
-- Profils des co-membres visibles (complète la policy self de 0002)
-- ---------------------------------------------------------------------------

create policy "profile_select_space_comembers"
on public.profile for select to authenticated
using (
  exists (
    select 1
    from public.space_member m
    where m.user_id = public.profile.id
      and public.is_space_member(m.space_id)
  )
);

-- ---------------------------------------------------------------------------
-- Lecture déchiffrante de space — pattern de référence du produit.
--
-- Pourquoi une fonction et pas une vue directe : dans une vue, les privilèges
-- des FONCTIONS appelées (private.dec) sont vérifiés avec les droits de
-- l'appelant, pas ceux du propriétaire. Exposer dec() à authenticated créerait
-- un oracle de déchiffrement (une fuite de base + n'importe quel compte
-- suffiraient à tout déchiffrer). D'où : une fonction SECURITY DEFINER qui
-- porte le déchiffrement ET le prédicat d'autorisation, et une vue par-dessus
-- pour l'ergonomie PostgREST. Le WHERE de la fonction EST la sécurité.
-- ---------------------------------------------------------------------------

create or replace function public.space_rows()
returns table (id uuid, name text, color text, created_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select s.id, private.dec(s.name_enc), s.color, s.created_at
  from private.space s
  where public.is_space_member(s.id) -- membres actifs uniquement
$$;

revoke all on function public.space_rows() from public;
revoke all on function public.space_rows() from anon;
grant execute on function public.space_rows() to authenticated;

create view public.space as select * from public.space_rows();

-- Pas de grant DELETE : un espace n'est jamais supprimé
revoke all on public.space from anon, authenticated;
grant select, insert, update on public.space to authenticated;

create or replace function private.space_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is null then
      raise exception 'not_authenticated';
    end if;
    if new.name is null or btrim(new.name) = '' then
      raise exception 'space_name_required';
    end if;
    insert into private.space (name_enc, color)
    values (private.enc(new.name), new.color)
    returning id, created_at into new.id, new.created_at;
    -- Le créateur devient le premier membre
    insert into public.space_member (space_id, user_id)
    values (new.id, (select auth.uid()));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'space_id_immutable';
    end if;
    update private.space
    set name_enc = private.enc(new.name),
        color    = new.color
    where id = old.id; -- old vient de la vue → déjà filtré par le WHERE
    return new;
  else
    -- SPEC : un espace n'est jamais supprimé, même vidé de ses membres
    raise exception 'space_delete_not_supported';
  end if;
end;
$$;

create trigger space_iiud
instead of insert or update or delete on public.space
for each row execute function private.space_view_iiud();

-- ---------------------------------------------------------------------------
-- space_invitation : colonnes posées dès maintenant (SPEC §8), flux différé (§7).
-- Aucune policy permissive → table verrouillée pour l'instant.
-- ---------------------------------------------------------------------------

create table public.space_invitation (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references private.space (id),
  email       text,
  token       uuid not null default gen_random_uuid(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profile (id),
  accepted_at timestamptz,
  created_by  uuid not null references public.profile (id),
  created_at  timestamptz not null default now()
);

alter table public.space_invitation enable row level security;
revoke all on table public.space_invitation from anon, authenticated;
