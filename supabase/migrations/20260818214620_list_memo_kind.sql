-- list.kind — les aide-mémoire du dashboard (Courses, Idées, Pense-bête).
--
-- Décision produit : ce sont de VRAIES listes et de VRAIES tâches (une ligne se
-- coche, se relie à une liste, se supprime comme n'importe quelle tâche), mais
-- elles sont CACHÉES de l'écran Tâches et n'existent que dans leur widget.
-- Créer une entité parallèle aurait dupliqué le chiffrement, les triggers, la
-- récurrence et les règles de propriété pour une différence qui tient en un
-- mot : où ça s'affiche.
--
-- `kind` n'est pas un libellé : le widget désigne sa liste par lui. Le nom, lui,
-- est chiffré et renommable — il ne peut pas servir de clé.

-- ---------------------------------------------------------------------------
-- 1. La colonne et ses contraintes
-- ---------------------------------------------------------------------------

alter table private.list add column kind text not null default 'task';

-- Énumération PLATE, jamais un `case` : sa branche `else` avalerait toute
-- valeur non listée. Ajouter un quatrième aide-mémoire = réécrire cette liste.
alter table private.list add constraint list_kind_check
  check (kind in ('task', 'courses', 'idees', 'notes'));

-- Un aide-mémoire est personnel par nature : il n'y a pas de « Courses »
-- d'espace, le widget est un bloc du dashboard de son propriétaire. Écrit en
-- positif sur le seul cas ouvert, pour qu'une valeur ajoutée plus tard tombe du
-- côté contraint plutôt que dans un `else` permissif.
alter table private.list add constraint list_memo_personal
  check (kind = 'task' or user_id is not null);

-- Un seul exemplaire de chaque aide-mémoire par compte. C'est cette contrainte
-- qui rend le semis idempotent : backfill et trigger d'inscription peuvent se
-- croiser sans dégât. Partielle — les listes ordinaires restent libres de se
-- répéter, un utilisateur peut avoir dix listes du même nom.
create unique index list_memo_unique
  on private.list (user_id, kind)
  where kind <> 'task';

-- ---------------------------------------------------------------------------
-- 2. La vue déchiffrante — séquence obligatoire pour ajouter une colonne :
--    `create or replace function` ne peut pas changer un `returns table`. Le
--    `drop view` emporte AUSSI le trigger `list_iiud` et les grants : tout doit
--    être reposé, sans quoi la vue est silencieusement en lecture seule.
--
--    Le WHERE est recopié tel quel : c'est LA sécurité de la vue.
-- ---------------------------------------------------------------------------

drop view public.list;
drop function public.list_rows();

create function public.list_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, kind text, name text, color text,
  "position" int, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.user_id, l.space_id, l.kind, private.dec(l.name_enc), l.color,
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

-- ---------------------------------------------------------------------------
-- 3. Le trigger INSTEAD OF, recopié de 0004 (sa seule version) avec trois
--    règles neuves autour de `kind` :
--
--    * à l'INSERT le client ne crée que des listes ordinaires — les aide-mémoire
--      sont posés par le serveur à l'inscription, en laisser créer ouvrirait un
--      deuxième « Courses » que le widget ne saurait pas départager. `kind` est
--      assigné à NEW pour que le RETURNING reflète la réalité ;
--    * `kind` est FIGÉ : basculer une liste de trente tâches en aide-mémoire la
--      ferait disparaître de l'écran Tâches sans que rien ne le dise ;
--    * un aide-mémoire ne se supprime pas : aucun écran ne le recrée. On le vide.
-- ---------------------------------------------------------------------------

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
    if coalesce(new.kind, 'task') <> 'task' then
      raise exception 'list_kind_not_allowed';
    end if;
    new.kind := 'task';
    insert into private.list (user_id, space_id, kind, name_enc, color, "position")
    values (new.user_id, new.space_id, new.kind, private.enc(new.name), new.color,
            coalesce(new."position", 0))
    returning id, created_at into new.id, new.created_at;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id then
      raise exception 'list_owner_immutable';
    end if;
    if new.kind is distinct from old.kind then
      raise exception 'list_kind_immutable';
    end if;
    -- `kind` n'entre pas dans le SET : il n'est modifiable par personne.
    update private.list
    set name_enc   = private.enc(new.name),
        color      = new.color,
        "position" = new."position"
    where id = old.id;
    return new;
  else
    if old.kind <> 'task' then
      raise exception 'list_memo_undeletable';
    end if;
    delete from private.list where id = old.id; -- les tâches sont détachées (set null)
    return old;
  end if;
end;
$$;

create trigger list_iiud
instead of insert or update or delete on public.list
for each row execute function private.list_view_iiud();

-- ---------------------------------------------------------------------------
-- 4. Le semis, en UN seul endroit — appelé par le trigger d'inscription (comptes
--    neufs) et par le backfill (comptes existants). Deux copies des trois noms
--    auraient divergé au premier renommage.
--
--    Ni SECURITY DEFINER ni exposée : definer et joignable, elle créerait des
--    listes chez autrui. Elle vit dans `private`, où les rôles API n'ont pas
--    même USAGE, et s'exécute avec les droits de son appelant.
-- ---------------------------------------------------------------------------

create or replace function private.seed_memo_lists(p_user uuid)
returns void
language sql
set search_path = ''
as $$
  insert into private.list (user_id, kind, name_enc, "position")
  select p_user, m.kind, private.enc(m.name), m.pos
  from (values
          ('courses', 'Courses',    0),
          ('idees',   'Idées',      1),
          ('notes',   'Pense-bête', 2)
       ) as m (kind, name, pos)
  on conflict (user_id, kind) where kind <> 'task' do nothing
$$;

revoke all on function private.seed_memo_lists(uuid) from public;
revoke all on function private.seed_memo_lists(uuid) from anon;
revoke all on function private.seed_memo_lists(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Comptes neufs : `private.handle_new_user()` recopiée de 0002 (sa seule
--    version) avec l'appel en plus. Le trigger `on_auth_user_created` n'est pas
--    recréé — `create or replace function` ne le casse pas.
--
--    Même transaction que le profil : la FK `private.list.user_id` est
--    satisfaite, et aucun compte ne peut exister sans ses aide-mémoire.
--    L'inscription dépend donc désormais de la clé du Vault. C'est le bon
--    comportement : sans elle rien ne serait créable de toute façon, et un
--    `exception when others` ici fabriquerait des comptes muets et irréparables.
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  perform private.seed_memo_lists(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Comptes existants. Une BOUCLE, et non un `insert … select` : sur une base
--    fraîche, `supabase db reset` joue les migrations AVANT `seed.sql`, seul
--    endroit qui pose la clé de dev. Il n'y a alors aucun profil, le corps ne
--    tourne jamais, `private.enc()` n'est pas appelée, et le reset passe. Un
--    `enc()` hors boucle casserait tout `db reset`.
--
--    Les comptes fermés (`deleted_at`) sont ignorés : on ne ressuscite rien.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in select id from public.profile where deleted_at is null loop
    perform private.seed_memo_lists(r.id);
  end loop;
end;
$$;

comment on column private.list.kind is
  'Nature de la liste : « task » (liste ordinaire, visible dans l''écran Tâches) ou l''un des aide-mémoire du dashboard (« courses », « idees », « notes »), semés par le serveur à l''inscription et invisibles dans l''écran Tâches.';
