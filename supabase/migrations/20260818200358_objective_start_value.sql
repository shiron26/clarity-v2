-- `objective.start_value` — l'origine de l'échelle d'un objectif quantifié, et
-- l'ouverture des cibles à la baisse.
--
-- Jusqu'ici la progression d'une quantité se lisait `value / target_value` :
-- une montée depuis zéro. Deux hypothèses y étaient enfouies, et les deux sont
-- fausses en mode relevé.
--
--   1. **Le sens est toujours la hausse.** « Perdre du poids », 78 kg vers
--      70 kg, donnait 111 % — borné à 100 %, donc « cible atteinte » le jour de
--      la création. La colonne `direction` ('atteindre' | 'sous') existait
--      depuis la migration 0017 pour exactement ce cas, mais elle n'était lue
--      nulle part : ni ici, ni côté front, qui la figeait à 'atteindre'.
--   2. **Le point de départ est toujours zéro.** Même à la hausse, un relevé de
--      82 kg vers 90 kg démarrait à 91 % sans que rien n'ait été fait. Le point
--      de départ saisi à la création était converti en premier `objective_entry`
--      puis oublié : aucune colonne ne le conservait, et le premier relevé ne
--      pouvait pas en tenir lieu (une saisie se corrige, une origine non).
--
-- D'où cette colonne. Elle est **figée à la création**, au même titre que
-- `measure` / `period_unit` / `entry_mode` : déplacer l'origine ré-échelonnerait
-- rétroactivement toute la progression passée. Changer de point de départ, c'est
-- supprimer et recréer.
--
-- `direction`, elle, reste modifiable — et elle doit l'être : elle se déduit de
-- `start_value` face à `target_value`, donc changer la cible peut la retourner.
-- Le front la recalcule à chaque écriture ; la base n'impose que sa cohérence de
-- forme (not null sur une quantité).

alter table private.objective add column start_value numeric;

-- Backfill AVANT la contrainte de forme. Le point de départ historique d'un
-- relevé, c'est sa première saisie ; un cumul part de zéro par définition.
update private.objective o
set start_value = case
      when o.entry_mode = 'releve' then coalesce((
        select e.value
        from public.objective_entry e
        where e.objective_id = o.id
        order by e.entry_date, e.created_at
        limit 1
      ), 0)
      else 0
    end
where o.measure = 'quantite';

-- Rattrapage du sens : un relevé dont le point de départ est AU-DESSUS de sa
-- cible est un objectif de seuil qui s'ignorait. C'est la seule écriture de
-- données de cette migration, et elle ne peut pas se tromper de cas — jusqu'ici
-- `direction` valait 'atteindre' partout, faute d'écran pour la choisir.
update private.objective
set direction = 'sous'
where measure = 'quantite'
  and entry_mode = 'releve'
  and start_value > target_value;

-- Les contraintes en `case` se RÉÉCRIVENT, elles ne se complètent pas : la
-- branche `else` avale toute valeur non listée (AGENTS.md §0.5).
alter table private.objective drop constraint objective_measure_shape;
alter table private.objective add constraint objective_measure_shape check (
  case measure
    when 'habitude' then
      cadence is not null
      and period_unit is not null
      and (period_unit <> 'week' or cadence between 1 and 7)
      and entry_mode is null
      and direction is null
      and start_value is null
    when 'quantite' then
      cadence is null                       -- implicitement 1 relevé par période
      and period_unit is not null
      and target_value is not null
      and entry_mode is not null
      and direction is not null
      and start_value is not null
    when 'jalons' then
      cadence is null
      and period_unit is null
      and target_value is null
      and unit is null
      and entry_mode is null
      and direction is null
      and start_value is null
  end
);

-- ---------------------------------------------------------------------------
-- La vue et sa fonction : la signature change, donc drop + create (un
-- `create or replace` ne peut pas ajouter une colonne de sortie).
--
-- Le `drop view` détruit aussi le trigger `objective_iiud` : il est recréé plus
-- bas. Les trois branches du WHERE sont recopiées telles quelles — la troisième
-- (forks des co-membres) doit survivre à toute réécriture.
-- ---------------------------------------------------------------------------

drop view public.objective;
drop function public.objective_rows();

create function public.objective_rows()
returns table (
  id uuid, user_id uuid, space_id uuid, parent_objective_id uuid,
  year int, quarter smallint, window_range daterange,
  kind text, slot smallint, label text, title text, why text, description text,
  measure text, period_unit text, cadence smallint,
  target_value numeric, unit text, entry_mode text, direction text,
  start_value numeric,
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
         o.start_value,
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

-- Grants explicites : les default privileges ne s'appliquent pas.
revoke all on function public.objective_rows() from public;
revoke all on function public.objective_rows() from anon;
grant execute on function public.objective_rows() to authenticated;

create view public.objective as select * from public.objective_rows();

revoke all on public.objective from anon, authenticated;
grant select, insert, update, delete on public.objective to authenticated;

-- ---------------------------------------------------------------------------
-- Le trigger INSTEAD OF, recréé à l'identique de la migration 0017 à deux
-- détails près : `start_value` entre dans l'INSERT, et rejoint la liste des
-- colonnes d'identité figées. Il n'entre PAS dans l'UPDATE.
-- ---------------------------------------------------------------------------

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
       start_value, closed_at, created_by)
    values
      (new.user_id, new.space_id, new.parent_objective_id, new.year, new.quarter,
       new.kind, new.slot,
       private.enc(new.label), private.enc(new.title), private.enc(new.why),
       private.enc(new.description),
       new.measure, new.period_unit, new.cadence, new.target_value, new.unit,
       new.entry_mode, new.direction,
       new.start_value, new.closed_at, (select auth.uid()))
    returning id, created_by, created_at, window_range
      into new.id, new.created_by, new.created_at, new.window_range;
    return new;

  elsif tg_op = 'UPDATE' then
    -- Identité figée : seul le contenu, le paramétrage chiffrable et la clôture
    -- bougent. `measure` / `period_unit` / `entry_mode` la rejoignent — changer
    -- l'unité de période orphelinerait tout l'historique d'objective_period, et
    -- basculer cumul → relevé changerait rétroactivement le sens des saisies
    -- passées. `start_value` la rejoint pour la même raison : l'origine de
    -- l'échelle décide de tous les pourcentages déjà lus. Changer de nature,
    -- c'est supprimer et recréer : le DELETE reste libre.
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id
       or new.parent_objective_id is distinct from old.parent_objective_id
       or new.year is distinct from old.year
       or new.quarter is distinct from old.quarter
       or new.kind is distinct from old.kind
       or new.slot is distinct from old.slot
       or new.measure is distinct from old.measure
       or new.period_unit is distinct from old.period_unit
       or new.entry_mode is distinct from old.entry_mode
       or new.start_value is distinct from old.start_value then
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
        -- Le sens se déduit du point de départ face à la cible : bouger la cible
        -- peut le retourner, il suit donc l'écriture.
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
