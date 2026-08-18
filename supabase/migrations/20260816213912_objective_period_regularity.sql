-- 0018 — objective_week → objective_period, et la régularité.
--
-- REFONTE §1.3. La table ne savait compter que des semaines ; une habitude
-- mensuelle et un relevé mensuel ont besoin de la même mécanique sur une autre
-- unité. Une seule table pour toute la régularité, quel que soit le type — c'est
-- ce qui permet à public.objective_regularity() de n'avoir qu'un seul chemin.
--
-- Sémantique de `target`, par mesure :
--   habitude  → la cadence, figée à la première activité de la période
--   quantite  → 1, une saisie attendue par période (done vaut 0 ou 1)
--   jalons    → aucune ligne : un objectif par étapes n'a pas de rythme

-- ---------------------------------------------------------------------------
-- Renommage. `alter table … rename` préserve les données, la policy et les
-- grants — contrairement à un drop/create qui les perdrait tous les trois.
-- ---------------------------------------------------------------------------

alter table public.objective_week rename to objective_period;
alter table public.objective_period rename column iso_year       to period_year;
alter table public.objective_period rename column iso_week       to period_index;
alter table public.objective_period rename column cadence_target to target;
alter table public.objective_period rename column active_days    to done;

-- `default 'week'` le temps de qualifier les lignes existantes (toutes
-- hebdomadaires par construction), puis retiré : l'unité devient explicite.
alter table public.objective_period
  add column period_unit text not null default 'week'
    check (period_unit in ('week', 'month'));
alter table public.objective_period alter column period_unit drop default;

alter table public.objective_period drop constraint objective_week_pkey;
alter table public.objective_period add constraint objective_period_pkey
  primary key (objective_id, period_unit, period_year, period_index);

alter policy "objective_week_select_visible" on public.objective_period
  rename to "objective_period_select_visible";

-- ---------------------------------------------------------------------------
-- Découpage en périodes — source UNIQUE, réutilisée par le rafraîchissement, le
-- backfill et la régularité. private.credit_day ne bouge pas : elle rend un
-- jour, l'agrégation en période se fait au-dessus.
-- ---------------------------------------------------------------------------

create or replace function private.period_start(p_unit text, p_day date)
returns date
language sql immutable
set search_path = ''
as $$
  select case when p_unit = 'week'
              then date_trunc('week',  p_day::timestamp)::date   -- lundi ISO
              else date_trunc('month', p_day::timestamp)::date
         end
$$;

create or replace function private.period_year(p_unit text, p_start date)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_unit = 'week'
              then extract(isoyear from p_start)::int
              else extract(year    from p_start)::int
         end
$$;

create or replace function private.period_index(p_unit text, p_start date)
returns int
language sql immutable
set search_path = ''
as $$
  select case when p_unit = 'week'
              then extract(week  from p_start)::int
              else extract(month from p_start)::int
         end
$$;

-- ---------------------------------------------------------------------------
-- Recalcul complet d'une période (idempotent) : gère complétion, décochage,
-- complétion tardive, changement d'échéance, suppression et saisie quantifiée,
-- sans compteur. `target` n'est JAMAIS réécrite : figée à la première activité.
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
    select count(distinct private.credit_day(t.due_date, t.completed_at)) into v_done
    from private.task t
    where t.objective_id = p_objective
      and t.completed_at is not null
      and private.period_start(o.period_unit,
            private.credit_day(t.due_date, t.completed_at)) = v_start;
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

drop function private.refresh_objective_week(uuid, date);

-- ---------------------------------------------------------------------------
-- Trigger AFTER sur private.task — inchangé, sauf l'appel à la nouvelle
-- fonction de relevé. Le bloc de récurrence est recopié à l'identique (0008).
-- ---------------------------------------------------------------------------

create or replace function private.on_task_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old_day date;
  v_new_day date;
  v_done_day date;
  v_next date;
  v_objective uuid;
begin
  -- 1. Relevé : rafraîchir chaque (objectif, période) touché
  if tg_op in ('UPDATE', 'DELETE')
     and old.completed_at is not null and old.objective_id is not null then
    v_old_day := private.credit_day(old.due_date, old.completed_at);
    perform private.refresh_objective_period(old.objective_id, v_old_day);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and new.completed_at is not null and new.objective_id is not null then
    v_new_day := private.credit_day(new.due_date, new.completed_at);
    if tg_op = 'INSERT'
       or old.completed_at is distinct from new.completed_at
       or old.due_date is distinct from new.due_date
       or old.objective_id is distinct from new.objective_id
       or v_old_day is distinct from v_new_day then
      perform private.refresh_objective_period(new.objective_id, v_new_day);
    end if;
  end if;

  -- 2. Récurrence : à la complétion uniquement (transition null → non null)
  if tg_op = 'UPDATE'
     and old.completed_at is null
     and new.completed_at is not null
     and new.recurrence is not null then
    v_done_day := private.app_day(new.completed_at);
    v_next := private.next_due(new.recurrence, v_done_day);
    if v_next is not null then
      -- objectif archivé → l'occurrence suivante naît détachée (SPEC §4.3)
      v_objective := new.objective_id;
      if v_objective is not null then
        select case when private.is_archived(o.year) then null else o.id end
        into v_objective
        from private.objective o where o.id = v_objective;
      end if;
      -- bytea recopiés tels quels : aucun re-chiffrement ; validation de
      -- rattachement court-circuitée (le cocheur n'est pas forcément
      -- le propriétaire du fork)
      perform set_config('clarity.system_write', 'on', true);
      insert into private.task
        (user_id, space_id, assignee_id, list_id, objective_id,
         title_enc, description_enc, due_date, is_important, "position", recurrence)
      values
        (new.user_id, new.space_id, new.assignee_id, new.list_id, v_objective,
         new.title_enc, new.description_enc, v_next, new.is_important,
         new."position", new.recurrence);
      perform set_config('clarity.system_write', '', true);
    end if;
  end if;

  return null; -- AFTER trigger
end;
$$;

-- ---------------------------------------------------------------------------
-- Symétrique côté saisies : une valeur posée, corrigée ou effacée rafraîchit sa
-- période, exactement comme une tâche cochée.
-- ---------------------------------------------------------------------------

create or replace function private.on_objective_entry_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_objective_period(old.objective_id, old.entry_date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform private.refresh_objective_period(new.objective_id, new.entry_date);
  end if;
  return null; -- AFTER trigger
end;
$$;

create trigger objective_entry_after_change
after insert or update or delete on public.objective_entry
for each row execute function private.on_objective_entry_change();

-- ---------------------------------------------------------------------------
-- Backfill (SPEC §4.1) : uniquement les périodes restées vides, pour qu'elles
-- apparaissent à 0 dans les bilans plutôt que d'être absentes. Idempotent,
-- rattrape les périodes manquées. Ignore les objectifs clôturés et archivés.
--
-- Couvre aussi les objectifs quantifiés : sans période vide à 0/1, un mois sans
-- relevé ne coûterait rien à la régularité.
-- ---------------------------------------------------------------------------

create or replace function private.backfill_objective_periods(p_unit text default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with candidates as (
    select o.id as objective_id,
           o.period_unit,
           case when o.measure = 'habitude' then o.cadence else 1 end as target,
           gs::date as p_start,
           o.window_range
    from private.objective o
    cross join lateral generate_series(
      -- de la période de création de l'objectif…
      private.period_start(o.period_unit, private.app_day(o.created_at))::timestamp,
      -- …à la dernière période révolue
      (private.period_start(o.period_unit, private.today())
        - case when o.period_unit = 'week' then interval '7 days'
                                           else interval '1 month' end)::timestamp,
      case when o.period_unit = 'week' then interval '7 days'
                                       else interval '1 month' end
    ) as gs
    where o.period_unit is not null
      and (p_unit is null or o.period_unit = p_unit)
      and o.closed_at is null              -- clôturé : périodes absentes, pas à zéro
      and not private.is_archived(o.year)
  ),
  inserted as (
    insert into public.objective_period
      (objective_id, period_unit, period_year, period_index, target, done)
    select c.objective_id,
           c.period_unit,
           private.period_year(c.period_unit, c.p_start),
           private.period_index(c.period_unit, c.p_start),
           c.target,
           0
    from candidates c
    where c.p_start <@ c.window_range      -- jamais hors de la fenêtre de l'objectif
    on conflict (objective_id, period_unit, period_year, period_index) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

drop function private.backfill_objective_weeks();

-- pg_cron tourne en UTC. Un job par unité : lundi 00:15 UTC (inchangé) et
-- 1er du mois 00:15 UTC.
select cron.unschedule('clarity-weekly-backfill');

select cron.schedule(
  'clarity-weekly-backfill',
  '15 0 * * 1',
  $$select private.backfill_objective_periods('week')$$
);

select cron.schedule(
  'clarity-monthly-backfill',
  '15 0 1 * *',
  $$select private.backfill_objective_periods('month')$$
);

-- ---------------------------------------------------------------------------
-- État hebdomadaire déduit d'un objectif d'espace (SPEC §4.2).
--
-- Les espaces sont hors du périmètre de la refonte, mais cette fonction lit les
-- anciennes colonnes : elle serait cassée par le renommage. Les noms de ses
-- arguments restent `p_iso_year` / `p_iso_week` — rien ne l'appelle côté front,
-- et PostgREST identifie une RPC par ses noms d'arguments : les changer serait
-- du churn sans bénéfice.
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
         count(*) filter (where p.done >= p.target)
  into v_forks, v_met
  from private.objective f
  left join public.objective_period p
    on p.objective_id = f.id
   and p.period_unit  = 'week'
   and p.period_year  = p_iso_year
   and p.period_index = p_iso_week
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

-- ---------------------------------------------------------------------------
-- Régularité (REFONTE §1.3).
--
-- Sur les 4 dernières périodes CLOSES, la part de l'attendu qui a été faite,
-- CHAQUE PÉRIODE PLAFONNÉE À 100 %. Une semaine à 5 séances sur 3 ne rachète pas
-- une semaine à 0 — on mesure un rythme, pas un volume.
--
-- Une période close est strictement antérieure à la période courante. Le chiffre
-- ne change donc qu'au passage à la période suivante, jamais pendant qu'on la
-- vit : c'est un prédicat, pas une action de clôture, et c'est ce qui rend la
-- mesure supportable.
--
-- Les valeurs projetées viennent du même appel parce que le rituel affiche les
-- deux (« 75 % → 83 % »). La fenêtre GLISSE, elle ne s'allonge pas : les 3
-- dernières closes plus la période en cours — la semaine 29 sort, la 33 entre.
-- Sans ça le front devrait recalculer, donc dupliquer la règle.
--
-- Les jalons n'apparaissent pas dans le résultat : ils n'ont pas de période,
-- donc pas de rythme. L'absence de ligne EST la règle produit.
-- ---------------------------------------------------------------------------

create or replace function public.objective_regularity(p_objectives uuid[])
returns table (
  objective_id     uuid,
  done             int,
  target           int,
  done_projected   int,
  target_projected int
)
language sql stable security definer
set search_path = ''
as $$
  with visible as (
    select o.id
    from unnest(p_objectives) as o (id)
    where public.is_objective_visible(o.id)
  ),
  obj as (
    select o.id,
           o.period_unit,
           private.period_year(o.period_unit,
             private.period_start(o.period_unit, private.today()))  as cur_year,
           private.period_index(o.period_unit,
             private.period_start(o.period_unit, private.today()))  as cur_index,
           -- Cible synthétique de la période en cours quand aucune ligne
           -- n'existe encore : le backfill ne remplit que le passé, et sans elle
           -- la projection ignorerait précisément la période qui entre.
           -- Jamais synthétisée sur un objectif clôturé, archivé ou hors de sa
           -- fenêtre : on fabriquerait un échec là où rien n'est attendu.
           case when o.closed_at is null
                 and not private.is_archived(o.year)
                 and private.today() <@ o.window_range
                then case when o.measure = 'habitude' then o.cadence else 1 end
           end as live_target
    from private.objective o
    join visible v on v.id = o.id
    where o.period_unit is not null
  ),
  closed as (
    select p.objective_id,
           p.target,
           least(p.done, p.target) as done,
           row_number() over (partition by p.objective_id
                              order by p.period_year desc, p.period_index desc) as rn
    from public.objective_period p
    join obj on obj.id = p.objective_id and obj.period_unit = p.period_unit
    where (p.period_year, p.period_index) < (obj.cur_year, obj.cur_index)
  ),
  current_period as (
    select p.objective_id,
           p.target,
           least(p.done, p.target) as done
    from public.objective_period p
    join obj on obj.id = p.objective_id and obj.period_unit = p.period_unit
    where (p.period_year, p.period_index) = (obj.cur_year, obj.cur_index)
  )
  select obj.id,
         coalesce(last4.done, 0),
         coalesce(last4.target, 0),
         coalesce(last3.done, 0) + coalesce(cur.done, 0),
         coalesce(last3.target, 0) + coalesce(cur.target, obj.live_target, 0)
  from obj
  left join lateral (
    select sum(c.done)::int as done, sum(c.target)::int as target
    from closed c where c.objective_id = obj.id and c.rn <= 4
  ) last4 on true
  left join lateral (
    select sum(c.done)::int as done, sum(c.target)::int as target
    from closed c where c.objective_id = obj.id and c.rn <= 3
  ) last3 on true
  left join current_period cur on cur.objective_id = obj.id
$$;

revoke all on function public.objective_regularity(uuid[]) from public;
revoke all on function public.objective_regularity(uuid[]) from anon;
grant execute on function public.objective_regularity(uuid[]) to authenticated;
