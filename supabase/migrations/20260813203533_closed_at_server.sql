-- 0014 — `closed_at` posé par le serveur, plus par le client.
--
-- Dernière donnée temporelle du produit encore confiée au navigateur, après
-- `task.completed_at` et `milestone.completed_at` (migration 0013). L'enjeu est
-- le même, en plus sensible : `closed_at` détermine la frontière à partir de
-- laquelle `private.refresh_objective_week` cesse de produire des relevés
-- hebdomadaires. Une horloge locale décalée décale donc l'historique lui-même —
-- et la SPEC §4.1 précise que les semaines de clôture restent absentes plutôt
-- que rattrapées à zéro : une frontière fausse est irrattrapable.
--
-- Comme pour les autres colonnes serveur, la valeur du client n'est lue que
-- comme un signal booléen (null = ouvert, non-null = atteint) et l'estampille
-- est assignée à NEW pour que le RETURNING reflète ce qui a été stocké.
-- Re-clôturer un objectif déjà clôturé ne redate pas : sans quoi une simple
-- réécriture de titre déplacerait la frontière des relevés.

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

    -- closed_at : imposé par le serveur (assigné à NEW pour que le RETURNING
    -- vu par le client reflète la réalité). Créer un objectif déjà « atteint »
    -- reste possible, mais l'instant vient d'ici.
    new.closed_at := case when new.closed_at is null then null
                          else now() end;

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
