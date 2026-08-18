-- 0020 — `public.objective_session` : une séance enregistrée sans tâche.
--
-- REFONTE §7, écran 2 du rituel (« réparer »). Le comportement bloc-notes observé
-- chez les testeurs — « je coche après coup, deux ou trois jours plus tard » — n'a
-- aujourd'hui aucun support : un jour crédité se reconstruit UNIQUEMENT depuis les
-- tâches, via `private.credit_day(due_date, completed_at)` (0008). Pour dire « j'ai
-- couru mercredi » il faudrait fabriquer une tâche, c'est-à-dire inventer une ligne
-- dans l'écran Tâches pour enregistrer un fait qui n'en est pas une.
--
-- La séance devient donc un objet à part entière. Un jour crédité est désormais
-- l'UNION des jours de tâches et des jours de séances — d'où les deux fonctions
-- réécrites en fin de fichier.
--
-- Aucune vue chiffrée n'est recréée ici : la procédure §0.2 ne s'applique pas, la
-- table est en clair. Aucune contrainte en `CASE` n'est touchée (§0.5), et
-- `private.credit_day` ne bouge pas — elle rend un jour de TÂCHE, ce qui reste vrai.

-- ---------------------------------------------------------------------------
-- La table.
--
-- Gabarit `public.objective_entry` (vraie table dans public + RLS avec policies)
-- et non gabarit `private.review_item` (table privée + vue déchiffrante) : un
-- couple (objectif, jour) ne porte aucun texte à chiffrer, et `objective_period.done`
-- expose déjà ces comptes en clair. Chiffrer ici coûterait une RPC de
-- déchiffrement par lecture pour ne rien protéger de plus.
-- ---------------------------------------------------------------------------

create table public.objective_session (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references private.objective (id) on delete cascade,
  -- Le SEUL endroit du dépôt où une date vient du client. Ailleurs (`entry_date`,
  -- `completed_at`, `closed_at`) le serveur estampille et la valeur envoyée n'est
  -- qu'un signal booléen. Ici c'est impossible : tout l'intérêt de l'écran est de
  -- créditer un jour PASSÉ. La valeur est donc bornée par le trigger ci-dessous —
  -- ni dans le futur, ni hors de la fenêtre de l'objectif.
  day          date not null,
  created_by   uuid not null default auth.uid() references public.profile (id),
  created_at   timestamptz not null default now(),
  -- Toucher deux fois la même case ne crédite pas deux fois : le geste est
  -- idempotent par construction, pas par la grâce du client.
  constraint objective_session_uniq unique (objective_id, day)
);

alter table public.objective_session enable row level security;

-- Grants explicites : les default privileges ne s'appliquent pas (AGENTS.md).
-- Pas d'`update`, et ce n'est pas un oubli : une séance se crée ou se supprime,
-- rien en elle ne peut changer. L'accorder obligerait à écrire un trigger
-- d'immuabilité qui n'autoriserait rien.
revoke all on table public.objective_session from anon, authenticated;
grant select, insert, delete on table public.objective_session to authenticated;

create index objective_session_idx on public.objective_session (objective_id, day desc);

create policy "objective_session_select"
on public.objective_session for select to authenticated
using (public.is_objective_visible(objective_id));

create policy "objective_session_insert"
on public.objective_session for insert to authenticated
with check (public.is_objective_visible(objective_id));

create policy "objective_session_delete"
on public.objective_session for delete to authenticated
using (public.is_objective_visible(objective_id));

-- ---------------------------------------------------------------------------
-- Validation à l'insertion. Calquée sur `private.validate_objective_entry()`.
--
-- `day` étant la seule date que le client choisisse, c'est ici que se joue tout
-- ce qui empêche d'écrire n'importe quoi.
-- ---------------------------------------------------------------------------

create or replace function private.validate_objective_session()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  o private.objective;
begin
  select * into o from private.objective where id = new.objective_id;
  if not found then
    raise exception 'objective_session_objective_not_found';
  end if;

  -- Seule une habitude compte des jours. Une quantité se relève (objective_entry),
  -- des jalons se franchissent (milestone) : ni l'une ni les autres n'ont de rythme
  -- quotidien à réparer.
  if o.measure <> 'habitude' then
    raise exception 'objective_session_not_habit';
  end if;

  if private.is_archived(o.year) then
    raise exception 'objective_archived_read_only';
  end if;

  if o.closed_at is not null then
    raise exception 'objective_session_closed';
  end if;

  -- Même raison que le `least(...)` de `private.credit_day` : on n'enregistre pas
  -- une séance qui n'a pas encore eu lieu.
  if new.day > private.today() then
    raise exception 'objective_session_future';
  end if;

  -- Hors fenêtre, `refresh_objective_period` ne produirait aucune ligne : la
  -- séance serait acceptée puis invisible. Mieux vaut la refuser franchement.
  if not (new.day <@ o.window_range) then
    raise exception 'objective_session_out_of_window';
  end if;

  new.created_by := (select auth.uid());
  new.created_at := now();
  return new;
end;
$$;

create trigger objective_session_validate
before insert on public.objective_session
for each row execute function private.validate_objective_session();

-- ---------------------------------------------------------------------------
-- Rafraîchissement du relevé — symétrique exact de `on_objective_entry_change`.
-- Pas de branche UPDATE : la table n'en accepte pas.
-- ---------------------------------------------------------------------------

create or replace function private.on_objective_session_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_objective_period(old.objective_id, old.day);
    return null;
  end if;
  perform private.refresh_objective_period(new.objective_id, new.day);
  return null; -- AFTER trigger
end;
$$;

create trigger objective_session_after_change
after insert or delete on public.objective_session
for each row execute function private.on_objective_session_change();

-- ---------------------------------------------------------------------------
-- Recalcul d'une période — réécrit pour compter l'UNION des jours.
--
-- Seule la branche `habitude` change ; tout le reste est recopié à l'identique
-- depuis 20260816213912 (le dépôt réécrit les fonctions entières plutôt que de
-- les patcher — cf. §0.3, c'est ce qui rend la version courante repérable).
--
-- `union` et NON `union all` : un jour où l'utilisateur a coché une tâche ET
-- touché la case de l'écran 2 compte pour un seul jour actif. C'est le point qui
-- fait tenir toute la mesure — `objective_period.done` est un nombre de JOURS,
-- pas un nombre d'actions.
-- ---------------------------------------------------------------------------

create or replace function private.refresh_objective_period(p_objective uuid, p_day date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  o        private.objective;
  v_start  date;
  v_target int;
  v_done   int;
begin
  select * into o from private.objective where id = p_objective;
  if not found or o.period_unit is null then
    return; -- jalons, secondaires jalonnés, objectifs d'espace : pas de relevé propre
  end if;
  if o.closed_at is not null then
    return; -- pendant une clôture, aucune ligne n'est produite (SPEC §4.1)
  end if;
  if private.is_archived(o.year) then
    return; -- l'archivage gèle l'objet
  end if;

  v_start := private.period_start(o.period_unit, p_day);

  -- Hors de la fenêtre de l'objectif, on ne produit rien : un objectif
  -- trimestriel ne doit pas accumuler des périodes vides après sa fenêtre —
  -- ce serait fabriquer un échec là où il n'y a plus d'attente. Pour un
  -- objectif annuel la fenêtre couvre l'année, donc le prédicat ne change rien.
  if not (v_start <@ o.window_range) then
    return;
  end if;

  if o.measure = 'habitude' then
    v_target := o.cadence;
    select count(*) into v_done from (
      select private.credit_day(t.due_date, t.completed_at) as d
      from private.task t
      where t.objective_id = p_objective
        and t.completed_at is not null
        and private.period_start(o.period_unit,
              private.credit_day(t.due_date, t.completed_at)) = v_start
      union
      select s.day
      from public.objective_session s
      where s.objective_id = p_objective
        and private.period_start(o.period_unit, s.day) = v_start
    ) days;
  else
    -- quantité : une saisie attendue par période, pas un volume
    v_target := 1;
    select least(count(*), 1)::int into v_done
    from public.objective_entry e
    where e.objective_id = p_objective
      and private.period_start(o.period_unit, e.entry_date) = v_start;
  end if;

  insert into public.objective_period
    (objective_id, period_unit, period_year, period_index, target, done)
  values
    (p_objective, o.period_unit,
     private.period_year(o.period_unit, v_start),
     private.period_index(o.period_unit, v_start),
     v_target, v_done)
  on conflict (objective_id, period_unit, period_year, period_index)
  do update set done = excluded.done;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jours actifs — même union.
--
-- Sans cette réécriture, la grille de densité et le relevé se contrediraient : une
-- séance ferait monter `objective_period.done` sans allumer sa case. Et le test de
-- concordance stricte de `03_dashboard_reads.sql` tomberait, ce qui est exactement
-- son rôle.
-- ---------------------------------------------------------------------------

create or replace function public.objective_active_days(
  p_objectives uuid[],
  p_from date,
  p_to date
)
returns table (objective_id uuid, day date)
language sql stable security definer
set search_path = ''
as $$
  with visible as (
    select o.id
    from unnest(p_objectives) as o (id)
    where public.is_objective_visible(o.id)
  )
  -- `union` dédoublonne : pas de `distinct` en plus, il ferait le travail deux fois.
  select t.objective_id,
         private.credit_day(t.due_date, t.completed_at)
  from private.task t
  join visible v on v.id = t.objective_id
  where t.completed_at is not null
    and private.credit_day(t.due_date, t.completed_at) between p_from and p_to
  union
  select s.objective_id, s.day
  from public.objective_session s
  join visible v on v.id = s.objective_id
  where s.day between p_from and p_to
$$;

revoke all on function public.objective_active_days(uuid[], date, date) from public;
revoke all on function public.objective_active_days(uuid[], date, date) from anon;
grant execute on function public.objective_active_days(uuid[], date, date) to authenticated;
