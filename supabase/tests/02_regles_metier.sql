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
  v_quant uuid;       -- secondaire quantifié mensuel de A
  v_annual uuid;      -- annuel de l'année suivante (tests de fenêtre)
  v_fork_a uuid;
  v_fork_b uuid;
  v_task uuid;
  v_entry uuid;
  v_session uuid;
  v_review uuid;
  v_qreview uuid;     -- bilan de trimestre (verdict et note y coexistent)
  v_rating smallint;
  v_achieved boolean;
  v_obj_check uuid;
  v_count int;
  v_slot int;
  v_i int;
  v_date date;
  v_seen date;      -- dernière visite (REFONTE §9)
  v_days int;
  v_target int;
  v_value numeric;
  v_reg_done int;
  v_reg_target int;
  v_reg_pdone int;
  v_reg_ptarget int;
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
  --    conservation par clôture, et unicité PAR FENÊTRE (REFONTE §1.1)
  -- =========================================================================
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'OBJ1', 'objectif 1', 'habitude', 'week', 3) returning id into v_obj;
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'OBJ2', 'objectif 2', 'habitude', 'week', 2) returning id into v_obj2;
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'OBJ3', 'objectif 3', 'habitude', 'week', 7);

  select slot into v_slot from public.objective where id = v_obj2;
  if v_slot = 2 then
    raise notice 'OK: slots attribués dans l''ordre (obj2 → slot 2)';
  else
    raise exception 'FAIL: obj2 a le slot %', v_slot;
  end if;

  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
    values (ua, v_year, 'principal', 'OBJ4', 'objectif 4', 'habitude', 'week', 1);
    raise exception 'FAIL: 4e principal accepté';
  exception when raise_exception then
    if sqlerrm like '%slot_full%' then
      raise notice 'OK: slot_full sur le 4e principal';
    else raise; end if;
  end;

  -- clôturer ne libère pas le slot : c'est la fin de la FENÊTRE qui le libère
  update public.objective set closed_at = now() where id = v_obj2;
  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
    values (ua, v_year, 'principal', 'OBJ4', 'objectif 4', 'habitude', 'week', 1);
    raise exception 'FAIL: le slot d''un objectif clôturé a été réattribué';
  exception when raise_exception then
    if sqlerrm like '%slot_full%' then
      raise notice 'OK: un objectif clôturé garde son slot';
    else raise; end if;
  end;
  update public.objective set closed_at = null where id = v_obj2; -- réversible

  -- supprimer libère le slot sans décaler les autres
  delete from public.objective where id = v_obj2;
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year, 'principal', 'OBJ2b', 'objectif 2 bis', 'habitude', 'week', 2)
  returning id into v_obj2;
  select slot into v_slot from public.objective where id = v_obj2;
  if v_slot = 2 then
    raise notice 'OK: le slot libéré (2) est réattribué';
  else
    raise exception 'FAIL: slot réattribué = %', v_slot;
  end if;

  -- Fenêtres : l'année suivante est vierge, les trois slots y sont libres.
  -- Deux trimestres DISJOINTS partagent un slot — c'est ce qui fait passer de
  -- trois principaux par an à trois principaux SIMULTANÉS.
  insert into public.objective (user_id, year, quarter, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year + 1, 1, 'principal', 'T1', 'objectif T1', 'habitude', 'week', 3);
  insert into public.objective (user_id, year, quarter, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year + 1, 3, 'principal', 'T3', 'objectif T3', 'habitude', 'week', 3);

  select count(*) into v_count from public.objective
  where user_id = ua and year = v_year + 1 and slot = 1;
  if v_count = 2 then
    raise notice 'OK: T1 et T3 partagent le slot 1 (fenêtres disjointes)';
  else
    raise exception 'FAIL: % objectif(s) sur le slot 1 de %', v_count, v_year + 1;
  end if;

  -- Un annuel chevauche T1 et T3 : l'attribution saute le slot 1.
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year + 1, 'principal', 'ANN', 'objectif annuel', 'habitude', 'week', 3)
  returning id into v_annual;
  select slot into v_slot from public.objective where id = v_annual;
  if v_slot = 2 then
    raise notice 'OK: l''annuel saute le slot 1, occupé sur des fenêtres qui le chevauchent';
  else
    raise exception 'FAIL: l''annuel a pris le slot %', v_slot;
  end if;

  -- …et forcer le slot de l'annuel sur un T2 (fenêtres chevauchantes) est
  -- refusé par la contrainte d'exclusion, pas par un trigger.
  begin
    insert into public.objective (user_id, year, quarter, kind, slot, label, title,
                                  measure, period_unit, cadence)
    values (ua, v_year + 1, 2, 'principal', 2, 'T2', 'objectif T2', 'habitude', 'week', 3);
    raise exception 'FAIL: un T2 a pris le slot d''un objectif annuel';
  exception when exclusion_violation then
    raise notice 'OK: annuel et T2 ne partagent pas un slot (fenêtres chevauchantes)';
  end;

  -- =========================================================================
  -- 3. Mesure : la forme par type, et qui a le droit d'être une habitude
  -- =========================================================================
  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
    values (ua, v_year, 'secondaire', 'SEC', 'secondaire', 'habitude', 'week', 3);
    raise exception 'FAIL: habitude acceptée sur un secondaire';
  exception when check_violation then
    raise notice 'OK: un secondaire n''est jamais une habitude';
  end;
  begin
    insert into public.objective (space_id, year, kind, label, title, measure, period_unit, cadence)
    values (v_space, v_year, 'principal', 'ESPH', 'espace à cadence', 'habitude', 'week', 3);
    raise exception 'FAIL: habitude acceptée sur un objectif d''espace';
  exception when check_violation then
    raise notice 'OK: un objectif d''espace n''a pas de rythme propre';
  end;
  begin
    -- année suivante : les slots de l'année courante sont déjà pleins
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit)
    values (ua, v_year + 2, 'principal', 'NOCAD', 'sans cadence', 'habitude', 'week');
    raise exception 'FAIL: habitude sans cadence acceptée';
  exception when check_violation then
    raise notice 'OK: cadence obligatoire sur une habitude';
  end;
  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
    values (ua, v_year + 2, 'principal', 'CAD8', 'huit par semaine', 'habitude', 'week', 8);
    raise exception 'FAIL: cadence 8 acceptée en hebdomadaire';
  exception when check_violation then
    raise notice 'OK: cadence bornée à 7 quand la période est la semaine';
  end;
  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, entry_mode, direction)
    values (ua, v_year + 2, 'principal', 'NOTGT', 'quantité sans cible', 'quantite', 'month', 'cumul', 'atteindre');
    raise exception 'FAIL: quantité sans cible acceptée';
  exception when check_violation then
    raise notice 'OK: target_value obligatoire sur une quantité';
  end;
  begin
    insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
    values (ua, v_year + 2, 'principal', 'JALCAD', 'jalons à cadence', 'jalons', null, 2);
    raise exception 'FAIL: cadence acceptée sur des jalons';
  exception when check_violation then
    raise notice 'OK: pas de cadence sur des jalons';
  end;
  -- une cadence de 8 est légitime au mois
  insert into public.objective (user_id, year, kind, label, title, measure, period_unit, cadence)
  values (ua, v_year + 2, 'principal', 'CAD8M', 'huit par mois', 'habitude', 'month', 8);
  raise notice 'OK: cadence 8 acceptée quand la période est le mois';

  insert into public.objective (user_id, year, kind, label, title, measure)
  values (ua, v_year, 'secondaire', 'SEC', 'secondaire', 'jalons') returning id into v_secondary;

  -- =========================================================================
  -- 4. Fork : parent principal d'espace uniquement, un par membre, restrict
  -- =========================================================================
  insert into public.objective (space_id, year, kind, label, title, measure)
  values (v_space, v_year, 'principal', 'ESP', 'objectif d''espace', 'jalons')
  returning id into v_space_obj;

  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, measure, period_unit, cadence)
    values (ua, v_secondary, v_year, 'F', 'fork de secondaire', 'habitude', 'week', 2);
    raise exception 'FAIL: fork d''un secondaire accepté';
  exception when raise_exception then
    if sqlerrm like '%fork_parent_must_be_space_principal%' then
      raise notice 'OK: fork d''un secondaire refusé';
    else raise; end if;
  end;

  insert into public.objective (user_id, parent_objective_id, year, label, title, measure, period_unit, cadence)
  values (ua, v_space_obj, v_year, 'F-A', 'fork de A', 'habitude', 'week', 2) returning id into v_fork_a;

  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, measure, period_unit, cadence)
    values (ua, v_space_obj, v_year, 'F-A2', 'fork 2 de A', 'habitude', 'week', 3);
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
  insert into public.objective (user_id, parent_objective_id, year, label, title, measure, period_unit, cadence)
  values (ub, v_space_obj, v_year, 'F-B', 'fork de B', 'habitude', 'week', 1) returning id into v_fork_b;

  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
  begin
    insert into public.objective (user_id, parent_objective_id, year, label, title, measure, period_unit, cadence)
    values ('00000000-0000-0000-0000-00000000000e', v_space_obj, v_year, 'F-E', 'fork de E', 'habitude', 'week', 1);
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
  -- 7. objective_period : jours distincts, complétion tardive, recalcul,
  --    cible figée (REFONTE §1.3 — la table s'appelait objective_week)
  -- =========================================================================
  insert into public.task (user_id, title, objective_id) values (ua, 't1', v_obj);
  insert into public.task (user_id, title, objective_id) values (ua, 't2', v_obj);
  insert into public.task (user_id, title, objective_id)
  values (ua, 't3', v_obj) returning id into v_task;

  update public.task set completed_at = now() where objective_id = v_obj and user_id = ua;

  select done, target into v_days, v_target
  from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', private.today()))
    and period_index = private.period_index('week', private.period_start('week', private.today()));
  if v_days = 1 and v_target = 3 then
    raise notice 'OK: 3 tâches le même jour = 1 jour actif, cible figée à 3';
  else
    raise exception 'FAIL: done=%, target=%', v_days, v_target;
  end if;

  -- décocher → recalcul
  update public.task set completed_at = null
  where objective_id = v_obj and user_id = ua;
  select done into v_days from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', private.today()))
    and period_index = private.period_index('week', private.period_start('week', private.today()));
  if v_days = 0 then
    raise notice 'OK: décochage → recalcul à 0';
  else
    raise exception 'FAIL: après décochage done=%', v_days;
  end if;

  -- cadence modifiée : la cible déjà figée ne bouge pas
  update public.objective set cadence = 5 where id = v_obj;
  update public.task set completed_at = now() where id = v_task;
  select target into v_target from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', private.today()))
    and period_index = private.period_index('week', private.period_start('week', private.today()));
  if v_target = 3 then
    raise notice 'OK: target reste figée à 3 malgré la cadence passée à 5';
  else
    raise exception 'FAIL: target réécrite à %', v_target;
  end if;

  -- Complétion tardive : échéance passée → on crédite la PÉRIODE de l'échéance.
  -- Bornée au 1er janvier : la fenêtre d'un objectif annuel s'arrête là, et
  -- refresh_objective_period ne produit rien hors fenêtre.
  v_date := greatest(private.today() - 14, make_date(v_year, 1, 1));
  insert into public.task (user_id, title, objective_id, due_date)
  values (ua, 'tâche en retard', v_obj, v_date) returning id into v_task;
  update public.task set completed_at = now() where id = v_task;
  select done into v_days from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', v_date))
    and period_index = private.period_index('week', private.period_start('week', v_date));
  if v_days >= 1 then
    raise notice 'OK: complétion tardive créditée sur la période de l''échéance';
  else
    raise exception 'FAIL: période de l''échéance done=%', v_days;
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
    raise exception 'FAIL: verdict accepté en hebdo';
  exception when raise_exception then
    if sqlerrm like '%achieved_year_only%' then
      raise notice 'OK: le verdict atteint/non ne se pose pas sur une semaine';
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

  -- Bilan de trimestre (REFONTE §8) : les deux formes y coexistent, parce que
  -- deux objectifs de la même session n'y sont pas au même stade — celui dont la
  -- fenêtre se ferme reçoit un verdict, celui qui continue reçoit une note.
  -- L'exclusivité porte donc sur la LIGNE, pas sur le niveau.
  insert into public.review (period_type, period_year, period_index, user_id)
  values ('quarter', v_year, 3, ua) returning id into v_qreview;

  insert into public.review_item (review_id, objective_id, achieved, comment)
  values (v_qreview, v_obj, true, 'trimestre bouclé');
  select achieved into v_achieved from public.review_item
  where review_id = v_qreview and objective_id = v_obj;
  if v_achieved then
    raise notice 'OK: le verdict atteint/non est accepté au bilan trimestriel';
  else
    raise exception 'FAIL: achieved = % au trimestre', v_achieved;
  end if;

  insert into public.review_item (review_id, objective_id, rating)
  values (v_qreview, v_obj2, 3);
  raise notice 'OK: la note en fusées reste acceptée au bilan trimestriel';

  begin
    insert into public.review_item (review_id, objective_id, rating, achieved)
    values (v_qreview, v_secondary, 2, false);
    raise exception 'FAIL: note et verdict acceptés sur la même ligne';
  exception when raise_exception then
    if sqlerrm like '%review_item_verdict_exclusive%' then
      raise notice 'OK: un objectif se note OU reçoit un verdict, pas les deux';
    else raise; end if;
  end;

  -- Le piège de l'UPDATE : `new` porte les valeurs anciennes des colonnes hors
  -- SET, donc poser un verdict sur une ligne déjà notée déclenche l'exclusivité
  -- sans que le client n'ait renvoyé la note. C'est ce qui oblige le front à
  -- effacer l'autre champ dans le même patch.
  begin
    update public.review_item set achieved = true
    where review_id = v_qreview and objective_id = v_obj2;
    raise exception 'FAIL: verdict posé par-dessus une note existante';
  exception when raise_exception then
    if sqlerrm like '%review_item_verdict_exclusive%' then
      raise notice 'OK: basculer note → verdict exige d’effacer la note';
    else raise; end if;
  end;

  update public.review_item set rating = null, achieved = true
  where review_id = v_qreview and objective_id = v_obj2;
  select rating, achieved into v_rating, v_achieved from public.review_item
  where review_id = v_qreview and objective_id = v_obj2;
  if v_rating is null and v_achieved then
    raise notice 'OK: la bascule passe quand les deux champs partent ensemble';
  else
    raise exception 'FAIL: rating = %, achieved = %', v_rating, v_achieved;
  end if;

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

  -- Jumelle du report : sortir du calendrier plutôt que repousser d'un jour.
  insert into public.task (user_id, title, due_date)
  values (ua, 'perso a dater plus tard', private.today() - 3);

  select public.undate_overdue_tasks() into v_count;
  if v_count >= 1 then
    raise notice 'OK: mise sans date en masse (% tâche(s) perso)', v_count;
  else
    raise exception 'FAIL: mise sans date count=%', v_count;
  end if;
  select count(*) into v_count from public.task
  where user_id = ua and title = 'perso a dater plus tard' and due_date is null;
  if v_count = 1 then
    raise notice 'OK: la tâche personnelle a perdu sa date';
  else
    raise exception 'FAIL: la tâche personnelle a gardé sa date';
  end if;
  select count(*) into v_count from public.task
  where space_id = v_space and due_date < private.today() and completed_at is null;
  if v_count = 1 then
    raise notice 'OK: les tâches d''espace ne sont jamais mises sans date';
  else
    raise exception 'FAIL: tâche d''espace mise sans date';
  end if;

  -- =========================================================================
  -- 11. Backfill hebdomadaire : périodes vides à 0, idempotent
  -- =========================================================================
  -- created_at s'antidate en écrivant directement dans private : la vue ne
  -- l'expose pas en écriture (c'est une colonne serveur).
  update private.objective set created_at = now() - interval '21 days' where id = v_obj2;
  select private.backfill_objective_periods('week') into v_count;
  if v_count >= 3 then
    raise notice 'OK: backfill hebdo remplit les périodes vides (% lignes)', v_count;
  else
    raise exception 'FAIL: backfill hebdo n''a créé que % lignes', v_count;
  end if;
  select private.backfill_objective_periods('week') into v_count;
  if v_count = 0 then
    raise notice 'OK: backfill hebdo idempotent (0 ligne au second passage)';
  else
    raise exception 'FAIL: backfill hebdo non idempotent (% lignes)', v_count;
  end if;

  -- =========================================================================
  -- 12. Objectif quantifié : saisies, période MENSUELLE, progression
  -- =========================================================================
  -- Un secondaire quantifié : c'est le seul type, avec les jalons, qu'un
  -- secondaire peut porter (il n'a pas de demande périodique, donc pas
  -- d'habitude). Le slot 1 des secondaires est pris par v_secondary.
  insert into public.objective (user_id, year, kind, label, title,
                                measure, period_unit, target_value, unit, entry_mode, direction)
  values (ua, v_year, 'secondaire', 'EPARGNE', 'Épargner 6 000 €',
          'quantite', 'month', 6000, '€', 'cumul', 'atteindre')
  returning id into v_quant;

  -- entry_date est posée par le SERVEUR : la valeur du client n'est pas lue.
  insert into public.objective_entry (objective_id, entry_date, value)
  values (v_quant, date '2020-01-01', 400) returning id into v_entry;
  select entry_date into v_date from public.objective_entry where id = v_entry;
  if v_date = private.today() then
    raise notice 'OK: entry_date ignorée du client, posée au jour applicatif';
  else
    raise exception 'FAIL: entry_date client conservée (%)', v_date;
  end if;

  begin
    insert into public.objective_entry (objective_id, value) values (v_obj, 10);
    raise exception 'FAIL: saisie acceptée sur un objectif non quantifié';
  exception when raise_exception then
    if sqlerrm like '%objective_entry_not_quantified%' then
      raise notice 'OK: pas de saisie sur une habitude';
    else raise; end if;
  end;

  begin
    update public.objective_entry set entry_date = private.today() - 1 where id = v_entry;
    raise exception 'FAIL: saisie redatée';
  exception when raise_exception then
    if sqlerrm like '%objective_entry_identity_immutable%' then
      raise notice 'OK: une saisie ne se redate pas, seule sa valeur bouge';
    else raise; end if;
  end;

  -- La saisie alimente une période MENSUELLE : une saisie attendue, donc 1/1.
  select done, target into v_days, v_target
  from public.objective_period
  where objective_id = v_quant
    and period_unit  = 'month'
    and period_year  = private.period_year('month', private.period_start('month', private.today()))
    and period_index = private.period_index('month', private.period_start('month', private.today()));
  if v_days = 1 and v_target = 1 then
    raise notice 'OK: une saisie remplit sa période mensuelle (1/1)';
  else
    raise exception 'FAIL: période mensuelle done=%, target=%', v_days, v_target;
  end if;

  -- Deux saisies le même mois valent toujours 1 : on mesure un rythme de relevé,
  -- pas un volume — et le cumul, lui, additionne.
  insert into public.objective_entry (objective_id, value) values (v_quant, 350);
  select done into v_days from public.objective_period
  where objective_id = v_quant
    and period_unit  = 'month'
    and period_year  = private.period_year('month', private.period_start('month', private.today()))
    and period_index = private.period_index('month', private.period_start('month', private.today()));
  select p.value, p.entries into v_value, v_count
  from public.objective_progress(array[v_quant]) p;
  if v_days = 1 and v_value = 750 and v_count = 2 then
    raise notice 'OK: deux saisies = 1 période remplie, cumul 750 € sur 2 saisies';
  else
    raise exception 'FAIL: done=%, value=%, entries=%', v_days, v_value, v_count;
  end if;

  -- En mode relevé, la dernière saisie remplace : elle ne s'additionne pas et
  -- peut baisser (un solde bancaire baisse).
  update private.objective set entry_mode = 'releve' where id = v_quant;
  select p.value into v_value from public.objective_progress(array[v_quant]) p;
  if v_value = 350 then
    raise notice 'OK: en mode relevé, la progression est la dernière saisie';
  else
    raise exception 'FAIL: progression en mode relevé = %', v_value;
  end if;
  update private.objective set entry_mode = 'cumul' where id = v_quant;

  -- Backfill mensuel : les mois révolus depuis la création, à 0 sur 1.
  update private.objective set created_at = make_date(v_year, 1, 1)
  where id = v_quant;
  select private.backfill_objective_periods('month') into v_count;
  if v_count = extract(month from private.today())::int - 1 then
    raise notice 'OK: backfill mensuel remplit les % mois révolus', v_count;
  else
    raise exception 'FAIL: backfill mensuel a créé % lignes (attendu %)',
      v_count, extract(month from private.today())::int - 1;
  end if;
  select private.backfill_objective_periods('month') into v_count;
  if v_count = 0 then
    raise notice 'OK: backfill mensuel idempotent';
  else
    raise exception 'FAIL: backfill mensuel non idempotent (% lignes)', v_count;
  end if;

  -- =========================================================================
  -- 13. Régularité : plafonnement par période, exclusion de la période en cours,
  --     fenêtre projetée qui GLISSE (REFONTE §1.3)
  -- =========================================================================
  -- Relevé fabriqué de toutes pièces : c'est la seule façon de contrôler cinq
  -- périodes closes sans faire voyager l'horloge.
  delete from public.objective_period where objective_id = v_obj;
  update public.objective set cadence = 3 where id = v_obj;

  -- de la plus récente à la plus ancienne : 3, 5, 3, 0, puis 3 hors fenêtre
  for v_i in 1..5 loop
    v_date := private.period_start('week', private.today()) - v_i * 7;
    insert into public.objective_period
      (objective_id, period_unit, period_year, period_index, target, done)
    values (v_obj, 'week',
            private.period_year('week', v_date), private.period_index('week', v_date),
            3, (array[3, 5, 3, 0, 3])[v_i]);
  end loop;
  -- période en cours : 2 sur 3
  v_date := private.period_start('week', private.today());
  insert into public.objective_period
    (objective_id, period_unit, period_year, period_index, target, done)
  values (v_obj, 'week',
          private.period_year('week', v_date), private.period_index('week', v_date), 3, 2);

  select r.done, r.target, r.done_projected, r.target_projected
  into v_reg_done, v_reg_target, v_reg_pdone, v_reg_ptarget
  from public.objective_regularity(array[v_obj]) r;

  -- 4 closes : 3 + min(5,3) + 3 + 0 = 9 sur 12. La 5e (3/3) est hors fenêtre,
  -- et la période en cours (2/3) n'est pas close.
  if v_reg_done = 9 and v_reg_target = 12 then
    raise notice 'OK: régularité 9/12 — période plafonnée, 5e période et période en cours exclues';
  else
    raise exception 'FAIL: régularité %/%', v_reg_done, v_reg_target;
  end if;

  -- projeté : la fenêtre GLISSE — les 3 dernières closes (9/9) plus la période
  -- en cours (2/3), donc 11/12. La plus ancienne sort, celle en cours entre.
  if v_reg_pdone = 11 and v_reg_ptarget = 12 then
    raise notice 'OK: régularité projetée 11/12 — la fenêtre glisse, elle ne s''allonge pas';
  else
    raise exception 'FAIL: régularité projetée %/%', v_reg_pdone, v_reg_ptarget;
  end if;

  -- sans ligne pour la période en cours, sa cible est synthétisée depuis la
  -- cadence : sinon la projection ignorerait la période qui entre.
  delete from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', private.today()))
    and period_index = private.period_index('week', private.period_start('week', private.today()));
  select r.done_projected, r.target_projected into v_reg_pdone, v_reg_ptarget
  from public.objective_regularity(array[v_obj]) r;
  if v_reg_pdone = 9 and v_reg_ptarget = 12 then
    raise notice 'OK: période en cours absente du relevé → cible synthétisée (9/12)';
  else
    raise exception 'FAIL: projection sans ligne courante %/%', v_reg_pdone, v_reg_ptarget;
  end if;

  -- un objectif jalonné n'a pas de régularité : pas de ligne du tout
  select count(*) into v_count from public.objective_regularity(array[v_secondary]);
  if v_count = 0 then
    raise notice 'OK: les jalons n''ont pas de régularité (aucune ligne rendue)';
  else
    raise exception 'FAIL: % ligne(s) de régularité pour un objectif jalonné', v_count;
  end if;

  -- =========================================================================
  -- 14. objective_session : la séance sans tâche (REFONTE §7, écran 2)
  -- =========================================================================
  -- Terrain remis à plat : v_obj est une habitude ANNUELLE (quarter null), sa
  -- fenêtre couvre donc toute l'année en cours.
  delete from public.task where objective_id = v_obj;
  delete from public.objective_period where objective_id = v_obj;
  update public.objective set cadence = 3 where id = v_obj;

  v_date := private.today();

  -- `day` est la seule date que le client choisisse : c'est le trigger qui la borne.
  begin
    insert into public.objective_session (objective_id, day) values (v_obj, v_date + 1);
    raise exception 'FAIL: séance dans le futur acceptée';
  exception when raise_exception then
    if sqlerrm like '%objective_session_future%' then
      raise notice 'OK: une séance qui n''a pas eu lieu est refusée';
    else raise; end if;
  end;

  begin
    insert into public.objective_session (objective_id, day)
    values (v_obj, make_date(v_year - 1, 12, 31));
    raise exception 'FAIL: séance hors fenêtre acceptée';
  exception when raise_exception then
    if sqlerrm like '%objective_session_out_of_window%' then
      raise notice 'OK: séance hors de la fenêtre de l''objectif refusée';
    else raise; end if;
  end;

  -- Seule une habitude compte des jours : une quantité se relève, des jalons se
  -- franchissent.
  begin
    insert into public.objective_session (objective_id, day) values (v_secondary, v_date);
    raise exception 'FAIL: séance sur un objectif jalonné acceptée';
  exception when raise_exception then
    if sqlerrm like '%objective_session_not_habit%' then
      raise notice 'OK: pas de séance sur des jalons';
    else raise; end if;
  end;

  begin
    insert into public.objective_session (objective_id, day) values (v_quant, v_date);
    raise exception 'FAIL: séance sur un objectif quantifié acceptée';
  exception when raise_exception then
    if sqlerrm like '%objective_session_not_habit%' then
      raise notice 'OK: pas de séance sur une quantité';
    else raise; end if;
  end;

  -- Une séance seule crédite son jour, sans qu'aucune tâche n'existe.
  insert into public.objective_session (objective_id, day)
  values (v_obj, v_date) returning id into v_session;

  select done, target into v_days, v_target from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', v_date))
    and period_index = private.period_index('week', private.period_start('week', v_date));
  if v_days = 1 and v_target = 3 then
    raise notice 'OK: une séance sans tâche crédite son jour (1/3)';
  else
    raise exception 'FAIL: séance seule done=%, target=%', v_days, v_target;
  end if;

  begin
    insert into public.objective_session (objective_id, day) values (v_obj, v_date);
    raise exception 'FAIL: deux séances le même jour acceptées';
  exception when unique_violation then
    raise notice 'OK: toucher deux fois la même case ne crédite pas deux fois';
  end;

  -- LE cas qui justifie le `union` : une tâche cochée le MÊME jour ne fait pas
  -- monter le compteur. `done` est un nombre de jours, pas un nombre d'actions.
  insert into public.task (user_id, title, objective_id, due_date)
  values (ua, 'même jour qu''une séance', v_obj, v_date) returning id into v_task;
  update public.task set completed_at = now() where id = v_task;

  select done into v_days from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', v_date))
    and period_index = private.period_index('week', private.period_start('week', v_date));
  if v_days = 1 then
    raise notice 'OK: séance + tâche le même jour = 1 jour actif';
  else
    raise exception 'FAIL: séance + tâche le même jour done=%', v_days;
  end if;

  -- Et la grille de densité raconte la même chose que le relevé.
  select count(*) into v_count
  from public.objective_active_days(array[v_obj], v_date, v_date);
  if v_count = 1 then
    raise notice 'OK: objective_active_days ne rend le jour qu''une fois';
  else
    raise exception 'FAIL: objective_active_days rend % ligne(s)', v_count;
  end if;

  -- Retirer la séance ne retire pas le jour : la tâche le tient encore. C'est ce
  -- qui distingue une union d'un compteur.
  delete from public.objective_session where id = v_session;
  select done into v_days from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', v_date))
    and period_index = private.period_index('week', private.period_start('week', v_date));
  if v_days = 1 then
    raise notice 'OK: séance retirée, la tâche tient toujours le jour';
  else
    raise exception 'FAIL: après retrait de la séance done=%', v_days;
  end if;

  delete from public.task where id = v_task;
  select done into v_days from public.objective_period
  where objective_id = v_obj
    and period_unit  = 'week'
    and period_year  = private.period_year('week', private.period_start('week', v_date))
    and period_index = private.period_index('week', private.period_start('week', v_date));
  if v_days = 0 then
    raise notice 'OK: plus rien ne tient le jour → done retombe à 0';
  else
    raise exception 'FAIL: après retrait des deux done=%', v_days;
  end if;

  -- Un objectif arrêté n'attend plus rien : on ne répare pas son passé.
  update public.objective set closed_at = now() where id = v_obj;
  begin
    insert into public.objective_session (objective_id, day) values (v_obj, v_date);
    raise exception 'FAIL: séance sur un objectif clôturé acceptée';
  exception when raise_exception then
    if sqlerrm like '%objective_session_closed%' then
      raise notice 'OK: pas de séance sur un objectif arrêté';
    else raise; end if;
  end;
  update public.objective set closed_at = null where id = v_obj;

  -- =========================================================================
  -- 15. touch_last_seen : apprendre l'écart et enregistrer la visite (REFONTE §9)
  -- =========================================================================
  -- A n'a encore jamais été vu : la colonne est nulle, et une donnée absente
  -- n'est PAS une absence — c'est ce qui évite que tous les comptes existants
  -- voient l'écran de retour le jour du déploiement.
  select public.touch_last_seen() into v_seen;
  if v_seen is null then
    raise notice 'OK: la première visite ne rend aucun écart';
  else
    raise exception 'FAIL: première visite = %', v_seen;
  end if;

  select last_seen_on into v_seen from public.profile where id = ua;
  if v_seen = private.today() then
    raise notice 'OK: la visite est estampillée au jour applicatif';
  else
    raise exception 'FAIL: last_seen_on = %', v_seen;
  end if;

  -- Rouvrir le même jour rend la date du jour, donc un écart nul : la cérémonie
  -- ne se rejoue pas d'un onglet à l'autre.
  select public.touch_last_seen() into v_seen;
  if v_seen = private.today() then
    raise notice 'OK: rouvrir le même jour ne fabrique pas une absence';
  else
    raise exception 'FAIL: second appel = %', v_seen;
  end if;

  -- La colonne n'a pas de `grant update` : le client ne peut pas forger sa date
  -- de dernière visite, même doctrine que completed_at et closed_at.
  --
  -- Le reste du fichier tourne en superuser, qui contourne les grants : c'est la
  -- seule assertion qui doit vraiment endosser le rôle `authenticated` pour avoir
  -- un sens. `set_config('role', …, true)` est local à la transaction.
  perform set_config('role', 'authenticated', true);
  begin
    update public.profile set last_seen_on = private.today() - 30 where id = ua;
    perform set_config('role', 'postgres', true);
    raise exception 'FAIL: last_seen_on écrite en direct';
  exception when insufficient_privilege then
    perform set_config('role', 'postgres', true);
    raise notice 'OK: last_seen_on ne s''écrit que par la RPC';
  end;

  -- La RPC agit sur l'appelant, jamais sur un autre profil : B n'a jamais ouvert
  -- l'app, sa ligne doit être restée intacte après les appels de A.
  select last_seen_on into v_seen from public.profile where id = ub;
  if v_seen is null then
    raise notice 'OK: touch_last_seen ne touche que la ligne de l''appelant';
  else
    raise exception 'FAIL: la visite de A a estampillé B (%)', v_seen;
  end if;
end $$;

rollback;
