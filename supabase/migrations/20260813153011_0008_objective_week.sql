-- 0008 — objective_week, trigger de complétion, récurrence, job hebdomadaire.
--
-- SPEC §3/§4.1 : la table existe pour figer la cadence en vigueur chaque semaine
-- (une vue recalculée réécrirait l'historique). Le compteur compte des JOURS
-- distincts, pas des tâches. Le relevé n'est pas immuable (complétion tardive).
-- SPEC §4.3 : la récurrence est une chaîne de tâches sans objet « série » —
-- la prochaine occurrence est créée à la complétion, échéance calculée depuis
-- la date de complétion.

create table public.objective_week (
  objective_id   uuid not null references private.objective (id) on delete cascade,
  iso_year       smallint not null,
  iso_week       smallint not null,
  cadence_target smallint not null,
  active_days    smallint not null default 0,
  primary key (objective_id, iso_year, iso_week)
);

alter table public.objective_week enable row level security;

-- Lecture seule pour le client ; seules les fonctions definer écrivent.
revoke all on table public.objective_week from anon, authenticated;
grant select on table public.objective_week to authenticated;

create policy "objective_week_select_visible"
on public.objective_week for select to authenticated
using (public.is_objective_visible(objective_id));

-- ---------------------------------------------------------------------------
-- Jour crédité par une complétion (SPEC §4.1) :
-- échéance passée → l'échéance ; échéance future ou absente → aujourd'hui.
-- ---------------------------------------------------------------------------

create or replace function private.credit_day(p_due date, p_completed timestamptz)
returns date
language sql stable
set search_path = ''
as $$
  select least(coalesce(p_due, private.app_day(p_completed)), private.app_day(p_completed))
$$;

-- ---------------------------------------------------------------------------
-- Recalcul complet d'une semaine (idempotent) : gère complétion, décochage,
-- complétion tardive, changement d'échéance et suppression, sans compteur.
-- cadence_target n'est JAMAIS réécrite : figée à la première activité.
-- ---------------------------------------------------------------------------

create or replace function private.refresh_objective_week(p_objective uuid, p_day date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_iso_year int := extract(isoyear from p_day)::int;
  v_iso_week int := extract(week from p_day)::int;
  o private.objective;
  v_days int;
begin
  select * into o from private.objective where id = p_objective;
  if not found or o.cadence is null then
    return; -- secondaires et objectifs d'espace : jamais de relevé propre
  end if;
  if o.closed_at is not null then
    return; -- pendant une clôture, aucune ligne n'est produite (SPEC §4.1)
  end if;
  if private.is_archived(o.year) then
    return; -- l'archivage gèle l'objet
  end if;

  select count(distinct private.credit_day(t.due_date, t.completed_at)) into v_days
  from private.task t
  where t.objective_id = p_objective
    and t.completed_at is not null
    and extract(isoyear from private.credit_day(t.due_date, t.completed_at))::int = v_iso_year
    and extract(week    from private.credit_day(t.due_date, t.completed_at))::int = v_iso_week;

  insert into public.objective_week (objective_id, iso_year, iso_week, cadence_target, active_days)
  values (p_objective, v_iso_year, v_iso_week, o.cadence, v_days)
  on conflict (objective_id, iso_year, iso_week)
  do update set active_days = excluded.active_days;
end;
$$;

-- ---------------------------------------------------------------------------
-- Prochaine échéance d'une récurrence, calculée depuis la date de complétion.
-- Motifs : {"type":"daily","interval":n} | {"type":"weekly","interval":n,"weekdays":[1..7]}
--          | {"type":"monthly","interval":n}   (1 = lundi ISO)
-- ---------------------------------------------------------------------------

create or replace function private.next_due(rule jsonb, from_day date)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v_type     text := rule ->> 'type';
  v_interval int  := greatest(coalesce((rule ->> 'interval')::int, 1), 1);
  v_weekdays int[];
  v_monday   date;
  d          date;
begin
  if v_type = 'daily' then
    return from_day + v_interval;

  elsif v_type = 'weekly' then
    select array_agg(x::int order by x::int) into v_weekdays
    from jsonb_array_elements_text(rule -> 'weekdays') x;
    v_monday := date_trunc('week', from_day::timestamp)::date;

    if v_weekdays is null then
      return from_day + 7 * v_interval;
    end if;

    -- un jour listé reste-t-il dans la semaine en cours, strictement après ?
    d := from_day + 1;
    while d <= v_monday + 6 loop
      if extract(isodow from d)::int = any (v_weekdays) then
        return d;
      end if;
      d := d + 1;
    end loop;

    -- sinon : premier jour listé de la semaine + interval
    d := v_monday + 7 * v_interval;
    while true loop
      if extract(isodow from d)::int = any (v_weekdays) then
        return d;
      end if;
      d := d + 1;
    end loop;

  elsif v_type = 'monthly' then
    -- l'arithmétique Postgres borne déjà fin de mois (31 janv + 1 mois = 28/29 févr) ;
    -- l'ancrage au 31 est perdu après un mois court : assumé par la SPEC §4.3
    return (from_day + make_interval(months => v_interval))::date;
  end if;

  return null; -- motif inconnu : la chaîne s'arrête silencieusement
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger AFTER sur private.task : relevé hebdo + génération de récurrence.
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
  -- 1. Relevé hebdomadaire : rafraîchir chaque (objectif, semaine) touché
  if tg_op in ('UPDATE', 'DELETE')
     and old.completed_at is not null and old.objective_id is not null then
    v_old_day := private.credit_day(old.due_date, old.completed_at);
    perform private.refresh_objective_week(old.objective_id, v_old_day);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and new.completed_at is not null and new.objective_id is not null then
    v_new_day := private.credit_day(new.due_date, new.completed_at);
    if tg_op = 'INSERT'
       or old.completed_at is distinct from new.completed_at
       or old.due_date is distinct from new.due_date
       or old.objective_id is distinct from new.objective_id
       or v_old_day is distinct from v_new_day then
      perform private.refresh_objective_week(new.objective_id, v_new_day);
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

create trigger task_after_change
after insert or update or delete on private.task
for each row execute function private.on_task_change();

-- ---------------------------------------------------------------------------
-- Job hebdomadaire (SPEC §4.1) : uniquement les semaines restées vides, pour
-- qu'elles apparaissent à 0 au bilan plutôt que d'être absentes. Idempotent,
-- rattrape les semaines manquées. Ignore les objectifs clôturés et archivés.
-- ---------------------------------------------------------------------------

create or replace function private.backfill_objective_weeks()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with candidate_weeks as (
    select o.id as objective_id,
           o.cadence,
           monday::date as monday
    from private.objective o
    cross join lateral generate_series(
      -- de la semaine de création de l'objectif…
      date_trunc('week', private.app_day(o.created_at)::timestamp),
      -- …à la dernière semaine révolue (lundi précédent le lundi courant)
      date_trunc('week', private.today()::timestamp) - interval '7 days',
      interval '7 days'
    ) as monday
    where o.cadence is not null            -- principaux perso + forks
      and o.closed_at is null              -- clôturé : semaines absentes, pas à zéro
      and not private.is_archived(o.year)
  ),
  inserted as (
    insert into public.objective_week
      (objective_id, iso_year, iso_week, cadence_target, active_days)
    select c.objective_id,
           extract(isoyear from c.monday)::int,
           extract(week from c.monday)::int,
           c.cadence,
           0
    from candidate_weeks c
    on conflict (objective_id, iso_year, iso_week) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;

-- pg_cron tourne en UTC : lundi 00:15 UTC = 01:15/02:15 Paris → toujours lundi
select cron.schedule(
  'clarity-weekly-backfill',
  '15 0 * * 1',
  $$select private.backfill_objective_weeks()$$
);
