-- Test d'étanchéité du chiffrement — LE test le plus important du produit.
-- Rejouable : tout est annulé par le ROLLBACK final. Exécuter en postgres :
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_etancheite.sql
-- Chaque assertion réussie émet un NOTICE "OK: …" ; un échec stoppe le script.

begin;

-- Clé Vault de test si absente (en hosted, la vraie clé existe déjà)
select vault.create_secret('cle-de-test-locale', 'clarity_app_key', 'test')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');

-- Deux utilisateurs de test (le trigger on_auth_user_created crée les profils)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- ---------------------------------------------------------------------------
-- Jeu de données : A crée une tâche perso et un espace (via les vues)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.task (user_id, title, description)
values ('00000000-0000-0000-0000-00000000000a', 'tâche secrète de A', 'description secrète');

insert into public.space (name) values ('espace de A');

do $$
declare
  v_space uuid;
  v_obj uuid;
  v_habit uuid;
  v_count int;
  v_title text;
begin
  select id into v_space from public.space limit 1;

  -- Tâche d'espace créée par A
  insert into public.task (space_id, title) values (v_space, 'tâche partagée');

  -- Objectif quantifié de A et une saisie. objective_entry est une table EN
  -- CLAIR (pas de vue déchiffrante) : son étanchéité repose entièrement sur ses
  -- policies RLS, pas sur le chiffrement — d'où sa place dans ce fichier.
  insert into public.objective (user_id, year, kind, label, title,
                                measure, period_unit, target_value, unit, entry_mode, direction)
  values ('00000000-0000-0000-0000-00000000000a', extract(year from private.today())::int,
          'principal', 'EPARGNE', 'Épargner', 'quantite', 'month', 6000, '€', 'cumul', 'atteindre')
  returning id into v_obj;
  insert into public.objective_entry (objective_id, value) values (v_obj, 400);

  -- Habitude de A et une séance. Même situation qu'objective_entry : table en
  -- clair, étanchéité portée par les seules policies RLS (REFONTE §7).
  insert into public.objective (user_id, year, kind, label, title,
                                measure, period_unit, cadence)
  values ('00000000-0000-0000-0000-00000000000a', extract(year from private.today())::int,
          'principal', 'COURIR', 'Courir', 'habitude', 'week', 3)
  returning id into v_habit;
  insert into public.objective_session (objective_id, day) values (v_habit, private.today());

  -- =========================================================================
  -- 1. Le rôle authenticated ne peut RIEN lire dans private, ni la clé
  -- =========================================================================
  execute 'set local role authenticated';

  begin
    execute 'select count(*) from private.task';
    raise exception 'FAIL: private.task lisible par authenticated';
  exception when insufficient_privilege then
    raise notice 'OK: private.task inaccessible pour authenticated';
  end;

  begin
    execute 'select private.app_key()';
    raise exception 'FAIL: app_key() exécutable par authenticated';
  exception when insufficient_privilege then
    raise notice 'OK: private.app_key() inaccessible pour authenticated';
  end;

  begin
    execute 'select vault.create_secret(''x'', ''y'')';
    raise exception 'FAIL: vault accessible par authenticated';
  exception when insufficient_privilege then
    raise notice 'OK: vault inaccessible pour authenticated';
  end;

  -- =========================================================================
  -- 2. A (authenticated) lit SES lignes, en clair, via les vues
  -- =========================================================================
  select count(*), min(title) into v_count, v_title
  from public.task where user_id = '00000000-0000-0000-0000-00000000000a';
  if v_count = 1 and v_title = 'tâche secrète de A' then
    raise notice 'OK: A lit sa tâche déchiffrée via la vue';
  else
    raise exception 'FAIL: lecture de A (count=%, title=%)', v_count, v_title;
  end if;

  select count(*) into v_count from public.space;
  if v_count = 1 then
    raise notice 'OK: A voit son espace';
  else
    raise exception 'FAIL: A devrait voir 1 espace, en voit %', v_count;
  end if;

  select count(*) into v_count from public.objective_entry;
  if v_count = 1 then
    raise notice 'OK: A lit sa saisie quantifiée';
  else
    raise exception 'FAIL: A voit % saisie(s)', v_count;
  end if;

  select count(*) into v_count from public.objective_session;
  if v_count = 1 then
    raise notice 'OK: A lit sa séance';
  else
    raise exception 'FAIL: A voit % séance(s)', v_count;
  end if;

  -- =========================================================================
  -- 3. B ne voit RIEN de A (ni tâche perso, ni espace, ni tâche d'espace)
  -- =========================================================================
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

  select count(*) into v_count from public.task;
  if v_count = 0 then
    raise notice 'OK: B ne voit aucune tâche de A';
  else
    raise exception 'FAIL: B voit % tâche(s) de A', v_count;
  end if;

  select count(*) into v_count from public.space;
  if v_count = 0 then
    raise notice 'OK: B ne voit pas l''espace de A';
  else
    raise exception 'FAIL: B voit l''espace de A';
  end if;

  select count(*) into v_count from public.objective_entry;
  if v_count = 0 then
    raise notice 'OK: B ne voit aucune saisie de A';
  else
    raise exception 'FAIL: B voit % saisie(s) de A', v_count;
  end if;

  begin
    insert into public.objective_entry (objective_id, value) values (v_obj, 999);
    raise exception 'FAIL: B a écrit une saisie sur l''objectif de A';
  exception when insufficient_privilege then
    raise notice 'OK: B ne peut pas saisir sur l''objectif de A';
  end;

  select count(*) into v_count from public.objective_session;
  if v_count = 0 then
    raise notice 'OK: B ne voit aucune séance de A';
  else
    raise exception 'FAIL: B voit % séance(s) de A', v_count;
  end if;

  begin
    insert into public.objective_session (objective_id, day)
    values (v_habit, private.today());
    raise exception 'FAIL: B a créé une séance sur l''objectif de A';
  exception when insufficient_privilege then
    raise notice 'OK: B ne peut pas créer de séance sur l''objectif de A';
  end;

  begin
    insert into public.task (user_id, title)
    values ('00000000-0000-0000-0000-00000000000a', 'intrusion');
    raise exception 'FAIL: B a écrit une tâche au nom de A';
  exception when raise_exception then
    if sqlerrm like '%task_write_not_allowed%' then
      raise notice 'OK: B ne peut pas écrire au nom de A';
    else
      raise;
    end if;
  end;

  -- =========================================================================
  -- 4. B devient membre → il voit l'espace et ses tâches ; parti → plus rien
  -- =========================================================================
  execute 'reset role';
  insert into public.space_member (space_id, user_id)
  values (v_space, '00000000-0000-0000-0000-00000000000b');
  execute 'set local role authenticated';

  select count(*) into v_count from public.space;
  if v_count = 1 then
    raise notice 'OK: B membre voit l''espace';
  else
    raise exception 'FAIL: B membre ne voit pas l''espace';
  end if;

  select count(*), min(title) into v_count, v_title
  from public.task where space_id = v_space;
  if v_count = 1 and v_title = 'tâche partagée' then
    raise notice 'OK: B membre lit la tâche d''espace en clair';
  else
    raise exception 'FAIL: B membre, tâches d''espace (count=%)', v_count;
  end if;

  -- B quitte : lecture seule émergente = plus aucun accès pour lui
  update public.space_member set left_at = now()
  where space_id = v_space and user_id = '00000000-0000-0000-0000-00000000000b';

  select count(*) into v_count from public.space;
  if v_count = 0 then
    raise notice 'OK: B parti ne voit plus l''espace';
  else
    raise exception 'FAIL: B parti voit encore l''espace';
  end if;

  -- =========================================================================
  -- 5. anon : aucun accès aux vues
  -- =========================================================================
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    execute 'select count(*) from public.task';
    raise exception 'FAIL: anon lit public.task';
  exception when insufficient_privilege then
    raise notice 'OK: anon n''a aucun accès à public.task';
  end;
  execute 'reset role';

  -- =========================================================================
  -- 6. En base, les données sont bien chiffrées (bytea PGP, pas de clair)
  -- =========================================================================
  select count(*) into v_count
  from private.task
  where position(convert_to('secrète', 'utf8') in title_enc) > 0;
  if v_count = 0 then
    raise notice 'OK: aucun titre en clair dans private.task';
  else
    raise exception 'FAIL: titre stocké en clair !';
  end if;
end $$;

rollback;
