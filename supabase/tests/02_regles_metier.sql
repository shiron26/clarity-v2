-- Tests des règles métier (SPEC §3, §4). Rejouable : ROLLBACK final.
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/02_regles_metier.sql

begin;

select vault.create_secret('cle-de-test-locale', 'clarity_app_key', 'test')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.local');

do $$
declare
  ua uuid := '00000000-0000-0000-0000-00000000000a';
  ub uuid := '00000000-0000-0000-0000-00000000000b';
  v_year int := extract(year from private.today())::int;
  v_space uuid;
  v_obj uuid;         -- principal perso de A
  v_obj2 uuid;
  v_space_obj uuid;   -- principal d'espace
  v_secondary uuid;   -- secondaire perso de A
  v_fork_a uuid;
  v_fork_b uuid;
  v_task uuid;
  v_review uuid;
  v_obj_check uuid;
  v_count int;
  v_slot int;
  v_date date;
  v_days int;
  v_target int;
  v_done timestamptz;
  v_done2 timestamptz;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

  -- =========================================================================
  -- 1. Espace : max 4 membres actifs
  -- =========================================================================
  insert into public.space (name) values ('espace test') returning id into v_space;
  insert into public.space_member (space_id, user_id) values
    (v_space, ub),
    (v_space, '00000000-0000-0000-0000-00000000000c'),
    (v_space, '00000000-0000-0000-0000-00000000000d');
  begin
    insert into public.space_member (space_id, user_id)
    values (v_space, '00000000-0000-0000-0000-00000000000e');
    raise exception 'FAIL: 5e membre accepté';
  exception when raise_exception then
    if sqlerrm like '%space_member_cap%' then
      raise notice 'OK: 5e membre refusé';
    else raise; end if;
  end;

  -- =========================================================================
  -- 2. Slots : plus petit slot libre, plein, libération par suppression,
  --    conservation par clôture
  -- =========================================================================
  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ua, v_year, 'principal', 'OBJ1', 'objectif 1', 3) returning id into v_obj;
  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ua, v_year, 'principal', 'OBJ2', 'objectif 2', 2) returning id into v_obj2;
  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ua, v_year, 'principal', 'OBJ3', 'objectif 3', 7);

  select slot into v_slot from public.objective where id = v_obj2;
  if v_slot = 2 then
    raise notice 'OK: slots attribués dans l''ordre (obj2 → slot 2)';
  else
    raise exception 'FAIL: obj2 a le slot %', v_slot;
  end if;

  begin
    insert into public.objective (user_id, year, kind, label, title, cadence)
    values (ua, v_year, 'principal', 'OBJ4', 'objectif 4', 1);
    raise exception 'FAIL: 4e principal accepté';
  exception when raise_exception then
    if sqlerrm like '%slot_full%' then
      raise notice 'OK: slot_full sur le 4e principal';
    else raise; end if;
  end;

  -- clôturer ne libère pas le slot
  update public.objective set closed_at = now() where id = v_obj2;
  begin
    insert into public.objective (user_id, year, kind, label, title, cadence)
    values (ua, v_year, 'principal', 'OBJ4', 'objectif 4', 1);
    raise exception 'FAIL: le slot d''un objectif clôturé a été réattribué';
  exception when raise_exception then
    if sqlerrm like '%slot_full%' then
      raise notice 'OK: un objectif clôturé garde son slot';
    else raise; end if;
  end;
  update public.objective set closed_at = null where id = v_obj2; -- réversible

  -- supprimer libère le slot sans décaler les autres
  delete from public.objective where id = v_obj2;
  insert into public.objective (user_id, year, kind, label, title, cadence)
  values (ua, v_year, 'principal', 'OBJ2b', 'objectif 2 bis', 2) returning id into v_obj2;
  select slot into v_slot from public.objective where id = v_obj2;
  if v_slot = 2 then
    raise notice 'OK: le slot libéré (2) est réattribué';
  else
    raise exception 'FAIL: slot réattribué = %', v_slot;
  end if;

  -- =========================================================================
  -- 3. Cadence : interdite sur un secondaire, obligatoire sur un principal perso
  -- =========================================================================
  begin
    insert into public.objective (user_id, year, kind, label, title, cadence)
    values (ua, v_year, 'secondaire', 'SEC', 'secondaire', 3);
    raise exception 'FAIL: cadence acceptée sur un secondaire';
  exception when check_violation then
    raise notice 'OK: cadence refusée sur un secondaire';
  end;
  begin
    -- année suivante : les slots de l'année courante sont déjà pleins
    insert into public.objective (user_id, year, kind, label, title)
    values (ua, v_year + 1, 'principal', 'NOCAD', 'sans cadence');
    raise exception 'FAIL: principal perso sans cadence accepté';
  exception when check_violation then
    raise notice 'OK: cadence obligatoire sur un principal perso';
  end;
  insert into public.objective (user_id, year, kind, label, title)
  values (ua, v_year, 'secondaire', 'SEC', 'secondaire') returning id into v_secondary;

  -- =========================================================================
  -- 4. Fork : parent principal d'espace uniquement, un par membre, restrict
  -- =========================================================================
  insert into public.objective (space_id, year, kind, label, title)
  values (v_space, v_year, 'principal', 'ESP', 'objectif d''espace')
  returning id into v_space_obj;

  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, cadence)
    values (ua, v_secondary, v_year, 'F', 'fork de secondaire', 2);
    raise exception 'FAIL: fork d''un secondaire accepté';
  exception when raise_exception then
    if sqlerrm like '%fork_parent_must_be_space_principal%' then
      raise notice 'OK: fork d''un secondaire refusé';
    else raise; end if;
  end;

  insert into public.objective (user_id, parent_objective_id, year, label, title, cadence)
  values (ua, v_space_obj, v_year, 'F-A', 'fork de A', 2) returning id into v_fork_a;

  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, cadence)
    values (ua, v_space_obj, v_year, 'F-A2', 'fork 2 de A', 3);
    raise exception 'FAIL: second fork du même membre accepté';
  exception when unique_violation then
    raise notice 'OK: un seul fork par membre et par objectif';
  end;

  begin
    delete from public.objective where id = v_space_obj;
    raise exception 'FAIL: suppression d''un objectif d''espace forké acceptée';
  exception when foreign_key_violation then
    raise notice 'OK: suppression du parent bloquée tant qu''il existe des forks';
  end;

  -- B (membre) forke aussi ; E (non-membre) ne peut pas
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  insert into public.objective (user_id, parent_objective_id, year, label, title, cadence)
  values (ub, v_space_obj, v_year, 'F-B', 'fork de B', 1) returning id into v_fork_b;

  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, cadence)
    values ('00000000-0000-0000-0000-00000000000e', v_space_obj, v_year, 'F-E', 'fork de E', 1);
    raise exception 'FAIL: fork par un non-membre accepté';
  exception when raise_exception then
    if sqlerrm like '%fork_author_not_member%' then
      raise notice 'OK: fork refusé à un non-membre';
    else raise; end if;
  end;

  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

  -- =========================================================================
  -- 5. Jalons : max 4 par trimestre, jamais sur un fork, trimestre immuable
  -- =========================================================================
  insert into public.milestone (objective_id, quarter, title) values
    (v_space_obj, 1, 'jalon 1'), (v_space_obj, 1, 'jalon 2'),
    (v_space_obj, 1, 'jalon 3'), (v_space_obj, 1, 'jalon 4');
  begin
    insert into public.milestone (objective_id, quarter, title)
    values (v_space_obj, 1, 'jalon 5');
    raise exception 'FAIL: 5e jalon du trimestre accepté';
  exception when raise_exception then
    if sqlerrm like '%milestone_cap%' then
      raise notice 'OK: max 4 jalons par trimestre';
    else raise; end if;
  end;

  begin
    insert into public.milestone (objective_id, quarter, title)
    values (v_fork_a, 2, 'jalon sur fork');
    raise exception 'FAIL: jalon sur un fork accepté';
  exception when raise_exception then
    if sqlerrm like '%milestone_on_fork%' then
      raise notice 'OK: pas de jalon sur un fork';
    else raise; end if;
  end;

  begin
    update public.milestone set quarter = 2
    where objective_id = v_space_obj and quarter = 1 and title = 'jalon 1';
    raise exception 'FAIL: déplacement de trimestre accepté';
  exception when raise_exception then
    if sqlerrm like '%milestone_quarter_immutable%' then
      raise notice 'OK: aucun déplacement entre trimestres';
    else raise; end if;
  end;

  -- =========================================================================
  -- 6. task.objective_id : principal perso ou fork uniquement
  -- =========================================================================
  begin
    insert into public.task (user_id, title, objective_id)
    values (ua, 't', v_secondary);
    raise exception 'FAIL: tâche liée à un secondaire acceptée';
  exception when raise_exception then
    if sqlerrm like '%task_objective_invalid_target%' then
      raise notice 'OK: tâche → secondaire refusée';
    else raise; end if;
  end;
  begin
    insert into public.task (user_id, title, objective_id)
    values (ua, 't', v_space_obj);
    raise exception 'FAIL: tâche liée à un objectif d''espace acceptée';
  exception when raise_exception then
    if sqlerrm like '%task_objective_invalid_target%' then
      raise notice 'OK: tâche → objectif d''espace refusée';
    else raise; end if;
  end;
  -- tâche d'espace rattachée à SON fork : ok
  insert into public.task (space_id, title, objective_id)
  values (v_space, 'tâche partagée sur fork A', v_fork_a);

  -- =========================================================================
  -- 7. objective_week : jours distincts, complétion tardive, recalcul,
  --    cadence figée, bord d'année ISO
  -- =========================================================================
  insert into public.task (user_id, title, objective_id) values (ua, 't1', v_obj);
  insert into public.task (user_id, title, objective_id) values (ua, 't2', v_obj);
  insert into public.task (user_id, title, objective_id)
  values (ua, 't3', v_obj) returning id into v_task;

  update public.task set completed_at = now() where objective_id = v_obj and user_id = ua;

  select active_days, cadence_target into v_days, v_target
  from public.objective_week
  where objective_id = v_obj
    and iso_year = extract(isoyear from private.today())::int
    and iso_week = extract(week from private.today())::int;
  if v_days = 1 and v_target = 3 then
    raise notice 'OK: 3 tâches le même jour = 1 jour actif, cadence figée à 3';
  else
    raise exception 'FAIL: active_days=%, cadence_target=%', v_days, v_target;
  end if;

  -- décocher → recalcul
  update public.task set completed_at = null
  where objective_id = v_obj and user_id = ua;
  select active_days into v_days from public.objective_week
  where objective_id = v_obj
    and iso_week = extract(week from private.today())::int
    and iso_year = extract(isoyear from private.today())::int;
  if v_days = 0 then
    raise notice 'OK: décochage → recalcul à 0';
  else
    raise exception 'FAIL: après décochage active_days=%', v_days;
  end if;

  -- cadence modifiée : la cible déjà figée ne bouge pas
  update public.objective set cadence = 5 where id = v_obj;
  update public.task set completed_at = now() where id = v_task;
  select cadence_target into v_target from public.objective_week
  where objective_id = v_obj
    and iso_week = extract(week from private.today())::int
    and iso_year = extract(isoyear from private.today())::int;
  if v_target = 3 then
    raise notice 'OK: cadence_target reste figée à 3 malgré la cadence passée à 5';
  else
    raise exception 'FAIL: cadence_target réécrite à %', v_target;
  end if;

  -- complétion tardive : échéance passée → on crédite la semaine de l'échéance
  v_date := private.today() - 14;
  insert into public.task (user_id, title, objective_id, due_date)
  values (ua, 'tâche en retard', v_obj, v_date) returning id into v_task;
  update public.task set completed_at = now() where id = v_task;
  select active_days into v_days from public.objective_week
  where objective_id = v_obj
    and iso_year = extract(isoyear from v_date)::int
    and iso_week = extract(week from v_date)::int;
  if v_days = 1 then
    raise notice 'OK: complétion tardive créditée sur la semaine de l''échéance';
  else
    raise exception 'FAIL: semaine de l''échéance active_days=%', v_days;
  end if;

  -- completed_at est posé par le serveur : la valeur du client n'est lue que
  -- comme un signal booléen, jamais reprise telle quelle (migration 0013).
  insert into public.task (user_id, title, due_date)
  values (ua, 'horloge client décalée', private.today()) returning id into v_task;
  update public.task set completed_at = timestamptz '2020-01-01' where id = v_task;
  select completed_at into v_done from public.task where id = v_task;
  if v_done > now() - interval '1 minute' then
    raise notice 'OK: completed_at ignoré du client, estampillé par le serveur';
  else
    raise exception 'FAIL: completed_at client conservé (%)', v_done;
  end if;

  -- une écriture ultérieure sur une tâche déjà cochée ne redate pas la complétion
  update public.task set title = 'titre réécrit' where id = v_task;
  select completed_at into v_done2 from public.task where id = v_task;
  if v_done2 = v_done then
    raise notice 'OK: re-cocher / réécrire ne redate pas la complétion';
  else
    raise exception 'FAIL: completed_at redaté (% → %)', v_done, v_done2;
  end if;

  -- closed_at d'un objectif : même doctrine, posé par le serveur (migration 0014)
  update public.objective set closed_at = timestamptz '2020-01-01' where id = v_obj;
  select closed_at into v_done from public.objective where id = v_obj;
  if v_done > now() - interval '1 minute' then
    raise notice 'OK: closed_at ignoré du client, estampillé par le serveur';
  else
    raise exception 'FAIL: closed_at client conservé (%)', v_done;
  end if;

  update public.objective set title = 'titre réécrit' where id = v_obj;
  select closed_at into v_done2 from public.objective where id = v_obj;
  if v_done2 = v_done then
    raise notice 'OK: réécrire un objectif clôturé ne redate pas la clôture';
  else
    raise exception 'FAIL: closed_at redaté (% → %)', v_done, v_done2;
  end if;

  -- rouvrir : clôture réversible (SPEC §3)
  update public.objective set closed_at = null where id = v_obj;
  if (select closed_at from public.objective where id = v_obj) is null then
    raise notice 'OK: rouvrir un objectif remet closed_at à null';
  else
    raise exception 'FAIL: réouverture sans effet';
  end if;

  -- décocher remet bien à null
  update public.task set completed_at = null where id = v_task;
  if (select completed_at from public.task where id = v_task) is null then
    raise notice 'OK: décocher remet completed_at à null';
  else
    raise exception 'FAIL: décochage sans effet';
  end if;

  -- =========================================================================
  -- 8. Récurrence : next_due (unitaires) + génération à la complétion
  -- =========================================================================
  if private.next_due('{"type":"daily","interval":1}', date '2026-01-31') = date '2026-02-01'
  then raise notice 'OK: next_due daily';
  else raise exception 'FAIL: next_due daily'; end if;

  if private.next_due('{"type":"monthly","interval":1}', date '2026-01-31') = date '2026-02-28'
  then raise notice 'OK: next_due mensuel borné fin février';
  else raise exception 'FAIL: next_due mensuel = %',
    private.next_due('{"type":"monthly","interval":1}', date '2026-01-31'); end if;

  -- mercredi 12/08/2026, jours [lun, mer, ven] → vendredi 14/08
  if private.next_due('{"type":"weekly","interval":1,"weekdays":[1,3,5]}', date '2026-08-12')
     = date '2026-08-14'
  then raise notice 'OK: next_due weekly jours précis';
  else raise exception 'FAIL: next_due weekly jours précis'; end if;

  -- lundi 10/08/2026, toutes les 2 semaines le lundi → lundi 24/08
  if private.next_due('{"type":"weekly","interval":2,"weekdays":[1]}', date '2026-08-10')
     = date '2026-08-24'
  then raise notice 'OK: next_due toutes les 2 semaines';
  else raise exception 'FAIL: next_due toutes les 2 semaines = %',
    private.next_due('{"type":"weekly","interval":2,"weekdays":[1]}', date '2026-08-10'); end if;

  -- génération à la complétion, échéance calculée depuis la date de complétion
  insert into public.task (user_id, title, due_date, recurrence)
  values (ua, 'habitude', private.today() - 3, '{"type":"daily","interval":2}')
  returning id into v_task;
  update public.task set completed_at = now() where id = v_task;

  select count(*) into v_count from public.task
  where user_id = ua and recurrence is not null and completed_at is null
    and due_date = private.today() + 2;
  if v_count = 1 then
    raise notice 'OK: occurrence suivante générée, échéance = complétion + 2 jours';
  else
    raise exception 'FAIL: occurrence suivante (count=%)', v_count;
  end if;

  -- =========================================================================
  -- 9. Reviews : unicité, cohérence de saisie, portée espace
  -- =========================================================================
  insert into public.review (period_type, period_year, period_index, user_id)
  values ('week', v_year, 33, ua) returning id into v_review;
  begin
    insert into public.review (period_type, period_year, period_index, user_id)
    values ('week', v_year, 33, ua);
    raise exception 'FAIL: doublon de review accepté';
  exception when unique_violation then
    raise notice 'OK: une seule review par période et par owner';
  end;

  insert into public.review_item (review_id, objective_id, rating, comment)
  values (v_review, v_obj, 2, 'bonne semaine');

  begin
    insert into public.review_item (review_id, objective_id, achieved)
    values (v_review, v_obj2, true);
    raise exception 'FAIL: verdict annuel accepté en hebdo';
  exception when raise_exception then
    if sqlerrm like '%achieved_year_only%' then
      raise notice 'OK: verdict atteint/non réservé au bilan annuel';
    else raise; end if;
  end;

  begin
    insert into public.review_item (review_id, objective_id, rating, comment)
    values (v_review, v_obj2, 1, repeat('x', 281));
    raise exception 'FAIL: commentaire de 281 caractères accepté';
  exception when raise_exception then
    if sqlerrm like '%comment_too_long%' then
      raise notice 'OK: commentaire limité à 280 caractères';
    else raise; end if;
  end;

  -- review d'espace : chacun ne note que SES forks ; seul le créateur valide
  insert into public.review (period_type, period_year, period_index, space_id)
  values ('week', v_year, 33, v_space) returning id into v_review;
  insert into public.review_item (review_id, objective_id, rating)
  values (v_review, v_fork_a, 3);

  begin
    insert into public.review_item (review_id, objective_id, rating)
    values (v_review, v_fork_b, 1);
    raise exception 'FAIL: A a noté le fork de B';
  exception when raise_exception then
    if sqlerrm like '%review_item_scope_space%' then
      raise notice 'OK: on ne note que ses propres forks';
    else raise; end if;
  end;

  -- B lit le commentaire du fork de A (public dans l'espace), mais ne valide pas
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
  select count(*) into v_count from public.review_item
  where review_id = v_review and objective_id = v_fork_a;
  if v_count = 1 then
    raise notice 'OK: les notes de fork sont visibles des co-membres';
  else
    raise exception 'FAIL: item de fork invisible pour B';
  end if;
  begin
    update public.review set validated_at = now() where id = v_review;
    raise exception 'FAIL: B a validé une session démarrée par A';
  exception when raise_exception then
    if sqlerrm like '%review_validate_creator_only%' then
      raise notice 'OK: seul celui qui a démarré valide';
    else raise; end if;
  end;
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
  -- L'estampille envoyée par le client est ignorée : elle n'est qu'un signal
  -- non-null, l'instant vient de now() (comme completed_at et closed_at).
  update public.review set validated_at = 'epoch'::timestamptz where id = v_review;
  select validated_at into v_done from public.review where id = v_review;
  if v_done > now() - interval '1 minute' then
    raise notice 'OK: le créateur valide, et validated_at est estampillé serveur';
  else
    raise exception 'FAIL: validated_at a gardé la valeur du client (%)', v_done;
  end if;
  select validated_by into v_obj_check from public.review where id = v_review;
  if v_obj_check = ua then
    raise notice 'OK: validated_by imposé par le serveur';
  else
    raise exception 'FAIL: validated_by = %', v_obj_check;
  end if;

  -- =========================================================================
  -- 9b. Ouverture des rituels : vendredi 18h (SPEC §4.4)
  -- =========================================================================
  select count(*) into v_count from public.review_openings(array[v_year])
  where period_type = 'week';
  if v_count in (52, 53) then
    raise notice 'OK: review_openings couvre les % semaines ISO de %', v_count, v_year;
  else
    raise exception 'FAIL: % semaines rendues pour %', v_count, v_year;
  end if;

  -- Chaque ouverture tombe un vendredi à 18h dans le fuseau de l'application.
  select count(*) into v_count from public.review_openings(array[v_year]) o
  where extract(isodow from (o.open_at at time zone private.app_tz())) <> 5
     or extract(hour   from (o.open_at at time zone private.app_tz())) <> 18;
  if v_count = 0 then
    raise notice 'OK: toutes les ouvertures tombent un vendredi à 18h locale';
  else
    raise exception 'FAIL: % ouverture(s) hors vendredi 18h', v_count;
  end if;

  -- Bilan trimestriel : dernier vendredi du trimestre, donc dans les 7 derniers
  -- jours du mois de clôture.
  select (o.open_at at time zone private.app_tz())::date into v_date
  from public.review_openings(array[v_year]) o
  where o.period_type = 'quarter' and o.period_index = 3;
  if v_date between make_date(v_year, 9, 24) and make_date(v_year, 9, 30) then
    raise notice 'OK: le bilan Q3 ouvre le dernier vendredi de septembre (%)', v_date;
  else
    raise exception 'FAIL: ouverture du bilan Q3 = %', v_date;
  end if;

  select count(*) into v_count from public.review_openings(array[v_year])
  where period_type = 'year' and period_index is null;
  if v_count = 1 then
    raise notice 'OK: une seule ouverture pour le bilan annuel';
  else
    raise exception 'FAIL: % ouverture(s) annuelle(s)', v_count;
  end if;

  -- =========================================================================
  -- 10. Report en masse : jamais les tâches d'espace
  -- =========================================================================
  insert into public.task (user_id, title, due_date)
  values (ua, 'perso en retard', private.today() - 1);
  insert into public.task (space_id, title, due_date)
  values (v_space, 'espace en retard', private.today() - 1);

  select public.postpone_overdue_tasks() into v_count;
  if v_count >= 1 then
    raise notice 'OK: report en masse (% tâche(s) perso)', v_count;
  else
    raise exception 'FAIL: report en masse count=%', v_count;
  end if;
  select count(*) into v_count from public.task
  where space_id = v_space and due_date < private.today() and completed_at is null;
  if v_count = 1 then
    raise notice 'OK: les tâches d''espace ne sont jamais reportées';
  else
    raise exception 'FAIL: tâche d''espace reportée';
  end if;

  -- =========================================================================
  -- 11. Backfill hebdomadaire : semaines vides à 0, idempotent
  -- =========================================================================
  update private.objective set created_at = now() - interval '21 days' where id = v_obj2;
  select private.backfill_objective_weeks() into v_count;
  if v_count >= 3 then
    raise notice 'OK: backfill remplit les semaines vides (% lignes)', v_count;
  else
    raise exception 'FAIL: backfill n''a créé que % lignes', v_count;
  end if;
  select private.backfill_objective_weeks() into v_count;
  if v_count = 0 then
    raise notice 'OK: backfill idempotent (0 ligne au second passage)';
  else
    raise exception 'FAIL: backfill non idempotent (% lignes)', v_count;
  end if;
end $$;

rollback;
