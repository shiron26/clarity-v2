-- 0017 — Fenêtre (annuelle ou trimestrielle) et type de mesure d'un objectif.
--
-- REFONTE §1.1 + §1.2, fusionnés en une seule migration : les deux recréent la
-- vue chiffrée public.objective, et `create or replace function` ne peut pas
-- changer un `returns table`. Éclater les deux blocs obligerait à jouer deux
-- fois la séquence drop view / drop function / recreate (§0.2).
--
-- Deux renversements de la SPEC initiale, amendés dans SPEC-CLARITY-BACKEND.md :
--   - la fenêtre d'un objectif n'est plus l'année : trois principaux SIMULTANÉS
--     plutôt que trois par an ;
--   - l'objectif quantifié, écarté en v1, revient comme type de mesure.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- §1.1 — Fenêtre
-- ---------------------------------------------------------------------------

-- Source UNIQUE du découpage en fenêtres : la colonne générée et le trigger
-- d'attribution de slot l'appellent tous les deux, ils ne peuvent donc pas
-- diverger. Immutable (make_date l'est), ce qui la rend légale dans un
-- `generated always as … stored`.
--
-- Bornes [début, fin) : un T1 va du 1er janvier inclus au 1er avril exclu, un
-- annuel du 1er janvier au 1er janvier suivant. C'est ce qui fait que T4 2026
-- ne chevauche pas T1 2027.
create or replace function private.objective_window(p_year int, p_quarter smallint)
returns daterange
language sql immutable
set search_path = ''
as $$
  select case
    when p_quarter is null then
      daterange(make_date(p_year, 1, 1), make_date(p_year + 1, 1, 1), '[)')
    else
      daterange(make_date(p_year, 1 + 3 * (p_quarter - 1), 1),
                (make_date(p_year, 1 + 3 * (p_quarter - 1), 1) + interval '3 months')::date,
                '[)')
  end
$$;

alter table private.objective
  add column quarter smallint check (quarter between 1 and 4),
  add column window_range daterange
    generated always as (private.objective_window(year, quarter)) stored;

-- Les deux index uniques partiels devenaient faux : ils interdisaient à un T1 et
-- à un T3 de partager un slot. L'exclusion dit la règle produit telle quelle —
-- « deux objectifs du même propriétaire, de même nature, ne peuvent pas occuper
-- le même slot sur des fenêtres qui se chevauchent » — et le moteur la vérifie à
-- chaque écriture, là où il aurait fallu un trigger.
drop index private.objective_slot_user_uniq;
drop index private.objective_slot_space_uniq;

-- Opclasses qualifiées : btree_gist vit dans `extensions`, hors du search_path
-- des migrations. Sans le préfixe, le DDL échoue selon le search_path courant.
alter table private.objective
  add constraint objective_slot_user_excl
  exclude using gist (
    user_id      extensions.gist_uuid_ops with =,
    kind         extensions.gist_text_ops with =,
    slot         extensions.gist_int2_ops with =,
    window_range with &&
  ) where (user_id is not null and slot is not null);

alter table private.objective
  add constraint objective_slot_space_excl
  exclude using gist (
    space_id     extensions.gist_uuid_ops with =,
    kind         extensions.gist_text_ops with =,
    slot         extensions.gist_int2_ops with =,
    window_range with &&
  ) where (space_id is not null and slot is not null);

-- ---------------------------------------------------------------------------
-- §1.2 — Type de mesure
-- ---------------------------------------------------------------------------

-- target_value et unit sont EN CLAIR, contrairement aux titres : chiffrées elles
-- ne seraient ni indexables ni agrégeables, et une RPC de déchiffrement par
-- somme ne se justifie pas. Si le modèle de menace évolue, la bascule en _enc
-- suit la procédure §0.2.
--
-- `unit` est un libellé d'affichage, pas une mesure : la valeur reste un numeric
-- nu, jamais "3 850 €".
alter table private.objective
  add column measure      text check (measure in ('habitude', 'quantite', 'jalons')),
  add column period_unit  text check (period_unit in ('week', 'month')),
  add column target_value numeric,
  add column unit         text,
  add column entry_mode   text check (entry_mode in ('cumul', 'releve')),
  -- Pas de `default 'atteindre'` malgré la lettre du §1.2 : un default peuplerait
  -- la colonne sur les habitudes et les jalons, ce qui violerait
  -- objective_measure_shape (qui la veut null hors quantité). C'est le front qui
  -- pré-sélectionne « atteindre ».
  add column direction    text check (direction in ('atteindre', 'sous'));

-- Backfill AVANT le not null et avant les contraintes de forme : l'existant est
-- soit une habitude hebdomadaire (il porte une cadence), soit des jalons.
update private.objective
set measure     = case when cadence is not null then 'habitude' else 'jalons' end,
    period_unit = case when cadence is not null then 'week' end;

alter table private.objective alter column measure set not null;

-- La cadence n'est plus bornée à 7 : c'est un nombre par PÉRIODE, et une période
-- peut être un mois. La borne réelle (7 en hebdo) est portée par la contrainte
-- de forme ci-dessous.
alter table private.objective drop constraint objective_cadence_check;
alter table private.objective add constraint objective_cadence_check
  check (cadence between 1 and 31);

-- Ces contraintes se RÉÉCRIVENT, elles ne se complètent pas (§0.5) : la branche
-- `else` d'un `case` avale silencieusement toute valeur non listée.
alter table private.objective drop constraint objective_cadence_shape;
alter table private.objective add constraint objective_cadence_shape check (
  case
    when parent_objective_id is not null then cadence is not null
    when measure = 'habitude'            then cadence is not null
    else                                      cadence is null
  end
);

-- La forme complète par mesure (tableau §1.2).
alter table private.objective add constraint objective_measure_shape check (
  case measure
    when 'habitude' then
      cadence is not null
      and period_unit is not null
      and (period_unit <> 'week' or cadence between 1 and 7)
      and entry_mode is null
      and direction is null
    when 'quantite' then
      cadence is null                       -- implicitement 1 relevé par période
      and period_unit is not null
      and target_value is not null
      and entry_mode is not null
      and direction is not null
    when 'jalons' then
      cadence is null
      and period_unit is null
      and target_value is null
      and unit is null
      and entry_mode is null
      and direction is null
  end
);

-- Qui a le droit d'être une habitude. Trois clauses, pas une :
--   1. un secondaire n'a pas de demande périodique — c'est sa définition même ;
--   2. un objectif d'espace n'a pas de rythme propre, son état se déduit de ses
--      forks (SPEC §4.2). Sans cette clause, la nouvelle forme — pilotée par
--      `measure` seul — autoriserait une cadence là où la base l'interdisait
--      jusqu'ici : une régression silencieuse ;
--   3. un fork épouse un rythme, c'est toujours une habitude.
alter table private.objective add constraint objective_measure_kind check (
  (kind is distinct from 'secondaire' or measure <> 'habitude')
  and (space_id is null or parent_objective_id is not null or measure <> 'habitude')
  and (parent_objective_id is null or measure = 'habitude')
);

-- ---------------------------------------------------------------------------
-- Recréation de la vue déchiffrante (§0.2 — séquence stricte).
-- Oublier le grant sur la vue la rend inaccessible, oublier le trigger la rend
-- silencieusement en lecture seule.
-- ---------------------------------------------------------------------------

drop view public.objective;            -- détruit aussi le trigger objective_iiud
drop function public.objective_rows();

-- Le WHERE porte TROIS branches : la troisième (forks des co-membres) a été
-- ajoutée en 0007 et doit survivre à toute réécriture, même si les espaces sont
-- hors du périmètre de la refonte (§0.3).
create function public.objective_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, parent_objective_id uuid,
  year int, quarter smallint, window_range daterange,
  kind text, slot smallint, label text, title text, why text, description text,
  measure text, period_unit text, cadence smallint,
  target_value numeric, unit text, entry_mode text, direction text,
  closed_at timestamptz, created_by uuid, created_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  select o.id, o.user_id, o.space_id, o.parent_objective_id,
         o.year, o.quarter, o.window_range,
         o.kind, o.slot,
         private.dec(o.label_enc), private.dec(o.title_enc), private.dec(o.why_enc),
         private.dec(o.description_enc),
         o.measure, o.period_unit, o.cadence,
         o.target_value, o.unit, o.entry_mode, o.direction,
         o.closed_at, o.created_by, o.created_at
  from private.objective o
  where o.user_id = (select auth.uid())
     or (o.space_id is not null and public.is_space_member(o.space_id))
     or (o.parent_objective_id is not null and exists (
           select 1 from private.objective p
           where p.id = o.parent_objective_id
             and p.space_id is not null
             and public.is_space_member(p.space_id)))
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
  v_window   daterange;
begin
  if tg_op = 'INSERT' then
    if not (new.user_id = (select auth.uid())
            or (new.space_id is not null and public.is_space_member(new.space_id))) then
      raise exception 'objective_write_not_allowed';
    end if;
    if private.is_archived(new.year) then
      raise exception 'objective_year_archived';
    end if;

    -- window_range est une colonne générée : la valeur envoyée par le client est
    -- ignorée, on la recalcule avec la même fonction que la table.
    v_window := private.objective_window(new.year, new.quarter);

    -- Attribution du plus petit slot libre, côté serveur. Le verrou consultatif
    -- garde l'ANNÉE comme granularité, et c'est correct : deux fenêtres ne
    -- peuvent se chevaucher que si elles partagent la même année (bornes
    -- [début, fin), donc T4 2026 ne touche pas T1 2027). Élargir la clé à la
    -- fenêtre laisserait deux insertions concurrentes (annuel + T2) passer le
    -- verrou séparément et se percuter sur la contrainte d'exclusion.
    -- Les forks n'ont pas de slot.
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
        where o.kind = new.kind and o.slot is not null
          and o.window_range && v_window
          and (o.user_id is not distinct from new.user_id)
          and (o.space_id is not distinct from new.space_id)
      );
      if new.slot is null then
        raise exception 'slot_full: aucun slot % libre sur %', new.kind, v_window;
      end if;
    end if;

    -- closed_at : imposé par le serveur (assigné à NEW pour que le RETURNING
    -- vu par le client reflète la réalité). Créer un objectif déjà « atteint »
    -- reste possible, mais l'instant vient d'ici.
    new.closed_at := case when new.closed_at is null then null
                          else now() end;

    insert into private.objective
      (user_id, space_id, parent_objective_id, year, quarter, kind, slot,
       label_enc, title_enc, why_enc, description_enc,
       measure, period_unit, cadence, target_value, unit, entry_mode, direction,
       closed_at, created_by)
    values
      (new.user_id, new.space_id, new.parent_objective_id, new.year, new.quarter,
       new.kind, new.slot,
       private.enc(new.label), private.enc(new.title), private.enc(new.why),
       private.enc(new.description),
       new.measure, new.period_unit, new.cadence, new.target_value, new.unit,
       new.entry_mode, new.direction,
       new.closed_at, (select auth.uid()))
    returning id, created_by, created_at, window_range
      into new.id, new.created_by, new.created_at, new.window_range;
    return new;

  elsif tg_op = 'UPDATE' then
    -- Identité figée : seul le contenu, le paramétrage chiffrable et la clôture
    -- bougent. `measure` / `period_unit` / `entry_mode` la rejoignent — changer
    -- l'unité de période orphelinerait tout l'historique d'objective_period, et
    -- basculer cumul → relevé changerait rétroactivement le sens des saisies
    -- passées. Changer de nature, c'est supprimer et recréer : le DELETE reste
    -- libre.
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id
       or new.parent_objective_id is distinct from old.parent_objective_id
       or new.year is distinct from old.year
       or new.quarter is distinct from old.quarter
       or new.kind is distinct from old.kind
       or new.slot is distinct from old.slot
       or new.measure is distinct from old.measure
       or new.period_unit is distinct from old.period_unit
       or new.entry_mode is distinct from old.entry_mode then
      raise exception 'objective_identity_immutable';
    end if;
    if private.is_archived(old.year) then
      raise exception 'objective_archived_read_only';
    end if;
    -- Un fork n'est modifiable que par son auteur (SPEC : il appartient à son auteur)
    if old.parent_objective_id is not null and old.user_id <> (select auth.uid()) then
      raise exception 'fork_owner_only';
    end if;
    -- closed_at : le client ne décide que du null / non-null, jamais de l'instant.
    new.closed_at := case
                       when new.closed_at is null then null
                       when old.closed_at is null then now()
                       else old.closed_at   -- re-clôturer ne redate pas
                     end;
    update private.objective
    set label_enc       = private.enc(new.label),
        title_enc       = private.enc(new.title),
        why_enc         = private.enc(new.why),
        description_enc = private.enc(new.description),
        cadence         = new.cadence,      -- ajustable : c'est tout l'objet du §9
        target_value    = new.target_value,
        unit            = new.unit,
        direction       = new.direction,
        closed_at       = new.closed_at     -- « atteint », réversible
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
-- objective_entry — les saisies d'un objectif quantifié.
--
-- En clair, donc gabarit public.review (vraie table dans public + RLS) et non
-- gabarit private.review_item (table privée + vue déchiffrante).
-- ---------------------------------------------------------------------------

create table public.objective_entry (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references private.objective (id) on delete cascade,
  -- Le default n'est jamais la valeur retenue — le trigger BEFORE l'écrase. Il
  -- existe pour que la colonne n'apparaisse pas obligatoire dans le type Insert
  -- généré : le client n'a pas le droit de choisir cette date, il ne doit donc
  -- pas avoir à en fournir une. Même forme que `created_by default auth.uid()`.
  entry_date   date not null default public.app_today(),
  value        numeric not null,
  created_by   uuid not null default auth.uid() references public.profile (id),
  created_at   timestamptz not null default now()
);

alter table public.objective_entry enable row level security;

revoke all on table public.objective_entry from anon, authenticated;
grant select, insert, update, delete on table public.objective_entry to authenticated;

create index objective_entry_idx on public.objective_entry (objective_id, entry_date desc);

create policy "objective_entry_select"
on public.objective_entry for select to authenticated
using (public.is_objective_visible(objective_id));

create policy "objective_entry_insert"
on public.objective_entry for insert to authenticated
with check (public.is_objective_visible(objective_id));

create policy "objective_entry_update"
on public.objective_entry for update to authenticated
using (public.is_objective_visible(objective_id))
with check (public.is_objective_visible(objective_id));

create policy "objective_entry_delete"
on public.objective_entry for delete to authenticated
using (public.is_objective_visible(objective_id));

-- entry_date est posée par le SERVEUR au jour applicatif — même doctrine que
-- completed_at et closed_at : saisir un relevé antidaté n'est pas un besoin du
-- produit, et l'horloge du navigateur n'a pas voix au chapitre.
create or replace function private.validate_objective_entry()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  o private.objective;
begin
  if tg_op = 'INSERT' then
    select * into o from private.objective where id = new.objective_id;
    if not found then
      raise exception 'objective_entry_objective_not_found';
    end if;
    if o.measure <> 'quantite' then
      raise exception 'objective_entry_not_quantified';
    end if;
    if private.is_archived(o.year) then
      raise exception 'objective_archived_read_only';
    end if;
    new.entry_date := private.today();
    new.created_by := (select auth.uid());
    -- clock_timestamp() et non now() : now() est l'instant de TRANSACTION, donc
    -- deux saisies écrites dans la même transaction porteraient le même
    -- created_at — et « la dernière valeur » du mode relevé n'aurait plus de
    -- sens. C'est le seul endroit du dépôt où la distinction compte.
    new.created_at := clock_timestamp();
    return new;
  end if;

  -- UPDATE : seule `value` bouge. Redater ou réattribuer une saisie réécrirait
  -- l'histoire d'une période déjà relevée.
  if new.objective_id is distinct from old.objective_id
     or new.entry_date is distinct from old.entry_date
     or new.created_by is distinct from old.created_by then
    raise exception 'objective_entry_identity_immutable';
  end if;
  return new;
end;
$$;

create trigger objective_entry_validate
before insert or update on public.objective_entry
for each row execute function private.validate_objective_entry();

-- ---------------------------------------------------------------------------
-- Progression d'un objectif quantifié.
--
-- `value` = somme des saisies en mode cumul, DERNIÈRE saisie en mode relevé.
-- Un relevé peut baisser (un solde bancaire baisse) : la fonction ne borne rien.
--
-- La visibilité est évaluée une fois par objectif (et non par saisie), même
-- patron que public.objective_active_days.
-- ---------------------------------------------------------------------------

create or replace function public.objective_progress(p_objectives uuid[])
returns table (objective_id uuid, value numeric, entries int, last_entry_date date)
language sql stable security definer
set search_path = ''
as $$
  with visible as (
    select o.id
    from unnest(p_objectives) as o (id)
    where public.is_objective_visible(o.id)
  ),
  ranked as (
    select e.objective_id, e.entry_date, e.value,
           row_number() over (partition by e.objective_id
                              order by e.entry_date desc, e.created_at desc) as rn
    from public.objective_entry e
    join visible v on v.id = e.objective_id
  )
  select v.id,
         case when o.entry_mode = 'releve'
              then coalesce((select r.value from ranked r
                             where r.objective_id = v.id and r.rn = 1), 0)
              else coalesce((select sum(r.value) from ranked r
                             where r.objective_id = v.id), 0)
         end,
         coalesce((select count(*)::int from ranked r where r.objective_id = v.id), 0),
         (select max(r.entry_date) from ranked r where r.objective_id = v.id)
  from visible v
  join private.objective o on o.id = v.id
$$;

revoke all on function public.objective_progress(uuid[]) from public;
revoke all on function public.objective_progress(uuid[]) from anon;
grant execute on function public.objective_progress(uuid[]) to authenticated;
