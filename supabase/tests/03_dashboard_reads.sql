-- Lectures du dashboard (0012) : app_today() et objective_active_days().
-- L'assertion centrale est la concordance stricte avec objective_week : la
-- fonction reconstruit les jours, elle ne doit jamais raconter autre chose que
-- le compteur hebdomadaire agrégé par le trigger.
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/03_dashboard_reads.sql

begin;

select vault.create_secret('cle-de-test-locale', 'clarity_app_key', 'test')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

do $$
declare
  ua uuid := '00000000-0000-0000-0000-00000000000a';
  ub uuid := '00000000-0000-0000-0000-00000000000b';
  v_year int := extract(year from private.today())::int;
  v_obj uuid;
  v_obj_b uuid;
  v_today date := private.today();
  v_days int;
  v_rows int;
  v_active int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

  -- app_today() doit renvoyer exactement private.today()
  if public.app_today() <> v_today then
    raise exception 'KO: app_today() = % au lieu de %', public.app_today(), v_today;
  end if;
  raise notice 'OK: app_today() = % (fuseau de app_config)', v_today;

  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ua, v_year, 'principal', 'SPORT', 'Courir', 3)
  returning id into v_obj;

  -- 3 tâches complétées le même jour = 1 jour actif ; 1 autre la veille
  insert into public.task (user_id, objective_id, title, due_date, completed_at)
  values
    (ua, v_obj, 't1', v_today, now()),
    (ua, v_obj, 't2', v_today, now()),
    (ua, v_obj, 't3', v_today, now()),
    (ua, v_obj, 't4', v_today - 1, now());

  select count(*) into v_days
  from public.objective_active_days(array[v_obj], v_today - 7, v_today);
  if v_days <> 2 then
    raise exception 'KO: % jours distincts au lieu de 2', v_days;
  end if;
  raise notice 'OK: 3 tâches le même jour = 1 jour actif (2 jours au total)';

  -- cohérence stricte avec objective_week sur la semaine courante
  select sum(ow.active_days) into v_active
  from public.objective_week ow
  where ow.objective_id = v_obj
    and (ow.iso_year, ow.iso_week) in (
      (extract(isoyear from v_today)::int, extract(week from v_today)::int),
      (extract(isoyear from v_today - 1)::int, extract(week from v_today - 1)::int)
    );
  if v_active <> v_days then
    raise exception 'KO: objective_week totalise % jours, la fonction en rend %', v_active, v_days;
  end if;
  raise notice 'OK: la fonction et objective_week concordent (% jours)', v_days;

  -- bornes exclues
  select count(*) into v_days
  from public.objective_active_days(array[v_obj], v_today, v_today);
  if v_days <> 1 then
    raise exception 'KO: bornes non respectées (% lignes)', v_days;
  end if;
  raise notice 'OK: les bornes de période filtrent bien';

  -- une tâche non complétée ne crédite rien
  insert into public.task (user_id, objective_id, title, due_date)
  values (ua, v_obj, 'pas faite', v_today - 2);
  select count(*) into v_days
  from public.objective_active_days(array[v_obj], v_today - 7, v_today);
  if v_days <> 2 then
    raise exception 'KO: une tâche non complétée a crédité un jour';
  end if;
  raise notice 'OK: une tâche non complétée ne crédite aucun jour';

  -- étanchéité : B ne doit rien voir de l'objectif de A
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  select count(*) into v_rows
  from public.objective_active_days(array[v_obj], v_today - 7, v_today);
  if v_rows <> 0 then
    raise exception 'KO: B lit % ligne(s) de l''objectif de A', v_rows;
  end if;
  raise notice 'OK: un tiers ne lit aucun jour de l''objectif de A';

  -- et un mélange visible/invisible ne fuit que le visible
  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ub, v_year, 'principal', 'LIRE', 'Lire', 2)
  returning id into v_obj_b;
  insert into public.task (user_id, objective_id, title, due_date, completed_at)
  values (ub, v_obj_b, 'b1', v_today, now());

  select count(*) into v_rows
  from public.objective_active_days(array[v_obj, v_obj_b], v_today - 7, v_today);
  if v_rows <> 1 then
    raise exception 'KO: tableau mixte → % ligne(s) au lieu de 1', v_rows;
  end if;
  raise notice 'OK: tableau mixte → seuls les objectifs visibles répondent';

  -- anon n'a aucun droit d'exécution
  begin
    perform set_config('request.jwt.claims', null, true);
    set local role anon;
    perform public.app_today();
    reset role;
    raise exception 'KO: anon a pu exécuter app_today()';
  exception when insufficient_privilege then
    reset role;
    raise notice 'OK: anon ne peut pas exécuter app_today()';
  end;
end $$;

rollback;
