-- Lectures du dashboard (0012) : app_today() et objective_active_days().
-- L'assertion centrale est la concordance stricte avec objective_period : la
-- fonction reconstruit les jours, elle ne doit jamais raconter autre chose que
-- le compteur agrégé par le trigger — et cela doit tenir pour les DEUX unités
-- de période, la semaine et le mois (REFONTE §1.3).
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
  v_obj_m uuid;   -- habitude MENSUELLE
  v_obj_s uuid;   -- habitude créditée par des SÉANCES (REFONTE §7)
  v_today date := private.today();
  v_prev date;
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

  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'SPORT', 'Courir', 'habitude', 'week', 3)
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

  -- cohérence stricte avec objective_period sur la semaine courante
  select sum(op.done) into v_active
  from public.objective_period op
  where op.objective_id = v_obj
    and op.period_unit = 'week'
    and (op.period_year, op.period_index) in (
      (private.period_year('week', private.period_start('week', v_today)),
       private.period_index('week', private.period_start('week', v_today))),
      (private.period_year('week', private.period_start('week', v_today - 1)),
       private.period_index('week', private.period_start('week', v_today - 1)))
    );
  if v_active <> v_days then
    raise exception 'KO: objective_period totalise % jours, la fonction en rend %', v_active, v_days;
  end if;
  raise notice 'OK: la fonction et objective_period concordent en hebdomadaire (% jours)', v_days;

  -- …et la même concordance doit tenir sur une unité MENSUELLE. Le nombre de
  -- jours n'est pas figé (le 1er du mois, les deux tâches tombent le même jour) :
  -- ce qui est testé, c'est l'égalité des deux lectures, pas une constante.
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'MUSCU', 'Renforcement', 'habitude', 'month', 8)
  returning id into v_obj_m;
  insert into public.task (user_id, objective_id, title, due_date, completed_at)
  values
    (ua, v_obj_m, 'm1', v_today, now()),
    (ua, v_obj_m, 'm2', private.period_start('month', v_today), now());

  select count(*) into v_days
  from public.objective_active_days(array[v_obj_m], private.period_start('month', v_today), v_today);
  select coalesce(sum(op.done), 0) into v_active
  from public.objective_period op
  where op.objective_id = v_obj_m
    and op.period_unit  = 'month'
    and op.period_year  = private.period_year('month', private.period_start('month', v_today))
    and op.period_index = private.period_index('month', private.period_start('month', v_today));
  if v_days < 1 then
    raise exception 'KO: aucune journée créditée sur l''objectif mensuel';
  end if;
  if v_active <> v_days then
    raise exception 'KO: mensuel — objective_period totalise %, la fonction rend %', v_active, v_days;
  end if;
  raise notice 'OK: la fonction et objective_period concordent en mensuel (% jours)', v_days;

  -- …et elle doit tenir quand le jour vient d'une SÉANCE et non d'une tâche
  -- (REFONTE §7, écran 2 du rituel). Un jour crédité est l'union des deux
  -- sources : si l'une des deux fonctions oubliait les séances, la grille de
  -- densité et le relevé se contrediraient.
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'YOGA', 'Yoga', 'habitude', 'week', 3)
  returning id into v_obj_s;

  -- Borné au 1er janvier : la fenêtre d'un objectif annuel s'arrête là, et une
  -- séance hors fenêtre est refusée (contrairement à une tâche, simplement
  -- ignorée). Le 1er janvier, les deux jours se confondent — d'où une assertion
  -- sur l'ÉGALITÉ des deux lectures, pas sur une constante.
  v_prev := greatest(v_today - 1, make_date(v_year, 1, 1));

  insert into public.task (user_id, objective_id, title, due_date, completed_at)
  values (ua, v_obj_s, 'y1', v_today, now());
  -- même jour que la tâche : ne doit rien ajouter
  insert into public.objective_session (objective_id, day) values (v_obj_s, v_today);
  -- jour que seule la séance tient
  insert into public.objective_session (objective_id, day) values (v_obj_s, v_prev)
  on conflict do nothing;

  select count(*) into v_days
  from public.objective_active_days(array[v_obj_s], v_today - 7, v_today);
  select coalesce(sum(op.done), 0) into v_active
  from public.objective_period op
  where op.objective_id = v_obj_s
    and op.period_unit = 'week'
    and (op.period_year, op.period_index) in (
      (private.period_year('week', private.period_start('week', v_today)),
       private.period_index('week', private.period_start('week', v_today))),
      (private.period_year('week', private.period_start('week', v_prev)),
       private.period_index('week', private.period_start('week', v_prev)))
    );
  if v_days < 1 then
    raise exception 'KO: aucune journée créditée par une séance';
  end if;
  if v_active <> v_days then
    raise exception 'KO: séances — objective_period totalise %, la fonction rend %', v_active, v_days;
  end if;
  raise notice 'OK: séances et tâches se fondent dans la même lecture (% jours)', v_days;

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
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ub, v_year, 'principal', 'LIRE', 'Lire', 'habitude', 'week', 2)
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
