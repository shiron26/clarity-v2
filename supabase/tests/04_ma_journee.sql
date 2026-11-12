-- « Ma journée » (SPEC-MA-JOURNEE) : jetons, ingestion, lecture, résumé, envoi.
-- L'ingestion est la seule surface `anon` du dépôt : la moitié de ce fichier
-- vérifie ce qu'elle NE fait PAS.
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/04_ma_journee.sql

begin;

select vault.create_secret('cle-de-test-locale', 'clarity_app_key', 'test')
where not exists (select 1 from vault.decrypted_secrets where name = 'clarity_app_key');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- Un payload valide, paramétré par le jour applicatif : construit en superuser,
-- rejoué ensuite sous `anon`.
create function pg_temp.payload(p_today date) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1,
    'generated_at', now(),
    'timezone', 'Europe/Paris',
    'window', jsonb_build_object(
      'start', p_today::timestamp at time zone private.app_tz(),
      'end', (p_today + 2)::timestamp at time zone private.app_tz()),
    'events', jsonb_build_array(
      jsonb_build_object('source_id', 'ev1@a', 'calendar', 'Perso', 'title', 'Point secret',
        'location', 'Salle 4', 'all_day', false,
        'start', (p_today + time '09:00') at time zone private.app_tz(),
        'end', (p_today + time '09:30') at time zone private.app_tz()),
      jsonb_build_object('source_id', 'ev2@a', 'calendar', 'Perso', 'title', 'Congés',
        'location', null, 'all_day', true,
        'start', to_char(p_today, 'YYYY-MM-DD'), 'end', to_char(p_today + 1, 'YYYY-MM-DD')),
      jsonb_build_object('source_id', 'ev3@a', 'calendar', 'Perso', 'title', 'Demain',
        'location', null, 'all_day', false,
        'start', (p_today + 1 + time '10:00') at time zone private.app_tz(),
        'end', (p_today + 1 + time '11:00') at time zone private.app_tz())),
    'emails', jsonb_build_array(
      jsonb_build_object('source_id', 'th1', 'from_name', 'Sidney', 'from_email', 'sidney@x.test',
        'subject', 'Contrat secret', 'received_at', now(), 'important', true,
        'url', 'https://mail.google.com/mail/u/0/#inbox/th1'),
      jsonb_build_object('source_id', 'th2', 'from_name', 'Pirate', 'from_email', 'p@x.test',
        'subject', 'Lien', 'received_at', now() - interval '1 hour',
        'url', 'javascript:alert(1)')),
    'birthdays', jsonb_build_array(
      jsonb_build_object('source', 'contacts', 'source_id', 'people/c1', 'name', 'Marie Dupont',
        'first_name', 'Marie', 'month', extract(month from p_today), 'day', extract(day from p_today),
        'year', 1999, 'phone', '33612345678'),
      jsonb_build_object('source', 'calendar', 'source_id', 'cal1', 'name', 'Paul Martin',
        'first_name', null, 'month', extract(month from p_today + 1), 'day', extract(day from p_today + 1),
        'year', null, 'phone', '06 12'))
  )
$$;

do $$
declare
  ua uuid := '00000000-0000-0000-0000-00000000000a';
  ub uuid := '00000000-0000-0000-0000-00000000000b';
  v_today date := private.today();
  v_tz text := private.app_tz(); -- lu en superuser : les rôles API ne voient pas `private`
  v_tok_a text;
  v_tok_b text;
  v_res jsonb;
  v_day jsonb;
  v_snapshot_1 text;
  v_snapshot_2 text;
  v_n int;
  v_manual uuid;
  v_payload jsonb;
begin
  -- ── Jetons ─────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  v_tok_a := public.create_ingest_token('Script A');
  if v_tok_a !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'FAIL: jeton mal formé (%)', v_tok_a;
  end if;
  raise notice 'OK: jeton base64url de 43 caractères';

  perform public.create_ingest_token('2');
  perform public.create_ingest_token('3');
  begin
    perform public.create_ingest_token('4');
    raise exception 'FAIL: 4e jeton actif accepté';
  exception when raise_exception then
    if sqlerrm <> 'ingest_token_cap' then raise; end if;
    raise notice 'OK: 3 jetons actifs au plus';
  end;

  begin
    execute 'select token_hash from public.ingest_token';
    raise exception 'FAIL: la vue ingest_token expose le hash';
  exception when undefined_column then
    raise notice 'OK: la vue ingest_token n''expose pas le hash';
  end;

  -- Révoquer libère une place.
  perform public.revoke_ingest_token((select id from public.ingest_token where label = '3'));
  perform public.create_ingest_token('3 bis');
  raise notice 'OK: révoquer libère une place';

  perform set_config('request.jwt.claims', '{"sub":"' || ub || '","role":"authenticated"}', true);
  v_tok_b := public.create_ingest_token('Script B');
  if (select count(*) from public.ingest_token) <> 1 then
    raise exception 'FAIL: B voit les jetons de A';
  end if;
  raise notice 'OK: jetons étanches entre utilisateurs';
  execute 'reset role';

  if exists (select 1 from private.ingest_token
             where token_hash = v_tok_a or position(v_tok_a in token_hash) > 0) then
    raise exception 'FAIL: jeton stocké en clair';
  end if;
  if not exists (select 1 from private.ingest_token
                 where token_hash = encode(extensions.digest(v_tok_a, 'sha256'), 'hex')) then
    raise exception 'FAIL: empreinte sha256 absente';
  end if;
  raise notice 'OK: seul le hash sha256 est en base';

  v_payload := pg_temp.payload(v_today);

  -- ── Surface anon ───────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  begin
    perform public.ingest_daily_snapshot('pas-un-jeton', v_payload);
    raise exception 'FAIL: jeton inconnu accepté';
  exception when raise_exception then
    if sqlerrm <> 'invalid token' then raise; end if;
    raise notice 'OK: jeton inconnu → invalid token';
  end;

  begin
    perform public.ingest_daily_snapshot(v_tok_a, v_payload || '{"version": 2}');
    raise exception 'FAIL: version 2 acceptée';
  exception when raise_exception then
    if sqlerrm <> 'invalid_payload: version' then raise; end if;
    raise notice 'OK: version ≠ 1 rejetée';
  end;

  begin
    perform public.ingest_daily_snapshot(v_tok_a, jsonb_set(v_payload, '{window,end}',
      to_jsonb((v_today + 5)::timestamp at time zone v_tz)));
    raise exception 'FAIL: fenêtre de 5 jours acceptée';
  exception when raise_exception then
    if sqlerrm <> 'invalid_payload: window' then raise; end if;
    raise notice 'OK: fenêtre > 3 jours rejetée';
  end;

  begin
    perform public.ingest_daily_snapshot(v_tok_a, jsonb_set(v_payload, '{emails}',
      (select jsonb_agg(v_payload -> 'emails' -> 0) from generate_series(1, 51))));
    raise exception 'FAIL: 51 mails acceptés';
  exception when raise_exception then
    if sqlerrm <> 'invalid_payload: too_many_emails' then raise; end if;
    raise notice 'OK: plus de 50 mails rejeté';
  end;

  begin
    perform public.ingest_daily_snapshot(v_tok_a, jsonb_set(v_payload, '{birthdays,0,source}', '"manual"'));
    raise exception 'FAIL: le script a écrit une ligne manual';
  exception when raise_exception then
    if sqlerrm <> 'invalid_payload: birthday' then raise; end if;
    raise notice 'OK: le script ne peut pas écrire de ligne manual';
  end;

  begin
    perform public.ingest_daily_snapshot(v_tok_a, jsonb_set(v_payload, '{events,0,start}', '"pas une date"'));
    raise exception 'FAIL: date illisible acceptée';
  exception when raise_exception then
    if sqlerrm <> 'invalid_payload: format' then raise; end if;
    raise notice 'OK: date illisible → invalid_payload: format';
  end;

  begin
    execute 'select count(*) from public.calendar_event';
    raise exception 'FAIL: anon lit calendar_event';
  exception when insufficient_privilege then
    raise notice 'OK: anon ne lit pas les vues';
  end;
  begin
    perform public.get_my_day(null);
    raise exception 'FAIL: anon appelle get_my_day';
  exception when insufficient_privilege then
    raise notice 'OK: anon n''appelle pas get_my_day';
  end;
  begin
    perform public.mark_my_day_viewed();
    raise exception 'FAIL: anon marque une journée vue';
  exception when insufficient_privilege then
    raise notice 'OK: anon ne marque pas de journée vue';
  end;
  begin
    perform public.create_ingest_token('anon');
    raise exception 'FAIL: anon crée un jeton';
  exception when insufficient_privilege then
    raise notice 'OK: anon ne crée pas de jeton';
  end;

  -- Un rejet ne laisse aucune trace.
  execute 'reset role';
  -- Bornée aux comptes du test : la base locale peut porter d'autres données.
  if exists (select 1 from private.calendar_event where user_id in (ua, ub))
     or exists (select 1 from private.email where user_id in (ua, ub)) then
    raise exception 'FAIL: un payload rejeté a écrit des lignes';
  end if;
  raise notice 'OK: un payload rejeté n''écrit rien';

  -- Ligne manuelle de A, posée par l'interface.
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.birthday (name, month, day, phone)
  values ('Léa Manuelle', extract(month from v_today), extract(day from v_today), '33700000000')
  returning id into v_manual;
  if (select source from public.birthday where id = v_manual) <> 'manual'
     or (select first_name from public.birthday where id = v_manual) <> 'Léa' then
    raise exception 'FAIL: ligne manuelle mal posée';
  end if;
  raise notice 'OK: anniversaire manuel créé (prénom déduit)';
  execute 'reset role';

  -- ── Ingestion ──────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  v_res := public.ingest_daily_snapshot(v_tok_a, v_payload);
  if v_res <> '{"ok": true, "events": 3, "emails": 2, "birthdays": 2}'::jsonb then
    raise exception 'FAIL: réponse inattendue %', v_res;
  end if;
  raise notice 'OK: ingestion acceptée (%)', v_res;
  execute 'reset role';

  select string_agg(x, '|' order by x) into v_snapshot_1 from (
    select 'e:' || source_id || ':' || starts_at || ':' || ends_at || ':' || private.dec(title_enc) as x
    from private.calendar_event where user_id = ua
    union all select 'm:' || source_id || ':' || private.dec(subject_enc) || ':' || coalesce(url, '∅')
    from private.email where user_id = ua
    union all select 'b:' || source || ':' || coalesce(source_id, '∅') || ':' || private.dec(name_enc)
      || ':' || coalesce(private.dec(phone_enc), '∅')
    from private.birthday where user_id = ua) s;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.ingest_daily_snapshot(v_tok_a, v_payload);
  execute 'reset role';

  select string_agg(x, '|' order by x) into v_snapshot_2 from (
    select 'e:' || source_id || ':' || starts_at || ':' || ends_at || ':' || private.dec(title_enc) as x
    from private.calendar_event where user_id = ua
    union all select 'm:' || source_id || ':' || private.dec(subject_enc) || ':' || coalesce(url, '∅')
    from private.email where user_id = ua
    union all select 'b:' || source || ':' || coalesce(source_id, '∅') || ':' || private.dec(name_enc)
      || ':' || coalesce(private.dec(phone_enc), '∅')
    from private.birthday where user_id = ua) s;

  if v_snapshot_1 is distinct from v_snapshot_2 then
    raise exception 'FAIL: deux envois identiques divergent';
  end if;
  raise notice 'OK: deux envois identiques laissent les mêmes lignes';

  -- Anniversaires inchangés : pas réécrits (mêmes identifiants de lignes).
  -- Modifiés : remplacés.
  select string_agg(id::text, ',' order by id) into v_snapshot_1
  from private.birthday where user_id = ua and source in ('contacts', 'calendar');
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  v_res := public.ingest_daily_snapshot(v_tok_a, v_payload);
  execute 'reset role';
  select string_agg(id::text, ',' order by id) into v_snapshot_2
  from private.birthday where user_id = ua and source in ('contacts', 'calendar');
  if v_snapshot_1 is distinct from v_snapshot_2 or (v_res ->> 'birthdays')::int <> 2 then
    raise exception 'FAIL: anniversaires inchangés réécrits (%)', v_res;
  end if;
  raise notice 'OK: section anniversaires inchangée, comptée sans être réécrite';

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.ingest_daily_snapshot(v_tok_a, jsonb_set(v_payload, '{birthdays,0,name}', '"Marie Durand"'));
  execute 'reset role';
  if not exists (select 1 from private.birthday where user_id = ua and private.dec(name_enc) = 'Marie Durand') then
    raise exception 'FAIL: section anniversaires modifiée non réécrite';
  end if;
  raise notice 'OK: section anniversaires modifiée, réécrite';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.ingest_daily_snapshot(v_tok_a, v_payload);
  execute 'reset role';

  if not exists (select 1 from private.birthday where id = v_manual) then
    raise exception 'FAIL: la synchro a supprimé la ligne manuelle';
  end if;
  raise notice 'OK: lignes manual intactes après synchro';

  if (select url from private.email where source_id = 'th2') is not null then
    raise exception 'FAIL: URL javascript: conservée';
  end if;
  raise notice 'OK: seul un permalien Gmail est conservé';

  if (select phone_enc from private.birthday where source_id = 'cal1') is not null then
    raise exception 'FAIL: téléphone invalide conservé';
  end if;
  raise notice 'OK: téléphone invalide → null, sans rejet';

  if (select starts_at from private.calendar_event where source_id = 'ev2@a')
     <> (v_today::timestamp at time zone v_tz) then
    raise exception 'FAIL: journée entière mal convertie';
  end if;
  raise notice 'OK: journée entière à minuit du fuseau applicatif';

  if exists (select 1 from private.calendar_event
             where user_id = ua and position(convert_to('secret', 'utf8') in title_enc) > 0)
     or exists (select 1 from private.email
                where user_id = ua and position(convert_to('secret', 'utf8') in subject_enc) > 0)
     or exists (select 1 from private.birthday
                where user_id = ua and position(convert_to('Marie', 'utf8') in name_enc) > 0) then
    raise exception 'FAIL: texte en clair dans une colonne _enc';
  end if;
  raise notice 'OK: aucun clair dans les colonnes _enc';

  -- Le remplacement de fenêtre : un événement retiré du payload disparaît.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.ingest_daily_snapshot(v_tok_a,
    jsonb_set(v_payload, '{events}', jsonb_build_array(v_payload -> 'events' -> 0)));
  execute 'reset role';
  if (select count(*) from private.calendar_event where user_id = ua) <> 1 then
    raise exception 'FAIL: la fenêtre n''a pas été remplacée';
  end if;
  raise notice 'OK: un événement retiré de la fenêtre disparaît';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  perform public.ingest_daily_snapshot(v_tok_a, v_payload);
  execute 'reset role';

  -- Un jeton révoqué ne sert plus.
  perform set_config('request.jwt.claims', '{"sub":"' || ub || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  perform public.revoke_ingest_token((select id from public.ingest_token));
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform public.ingest_daily_snapshot(v_tok_b, v_payload);
    raise exception 'FAIL: jeton révoqué accepté';
  exception when raise_exception then
    if sqlerrm <> 'invalid token' then raise; end if;
    raise notice 'OK: jeton révoqué → invalid token (même message)';
  end;
  execute 'reset role';

  -- ── Lecture ────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  v_day := public.get_my_day(null);
  if (v_day ->> 'date')::date <> v_today then
    raise exception 'FAIL: get_my_day ne part pas du jour applicatif';
  end if;
  if jsonb_array_length(v_day #> '{events,today}') <> 2
     or (v_day #>> '{events,today,0,title}') <> 'Congés'
     or jsonb_array_length(v_day #> '{events,tomorrow}') <> 1 then
    raise exception 'FAIL: événements du jour mal triés ou mal bornés (%)', v_day -> 'events';
  end if;
  raise notice 'OK: journées entières d''abord, demain séparé';
  if (v_day #>> '{emails,0,from_name}') <> 'Sidney' then
    raise exception 'FAIL: mails non triés par réception décroissante';
  end if;
  raise notice 'OK: mails par réception décroissante';
  if not (v_day #>> '{emails,0,important}')::boolean or (v_day #>> '{emails,1,important}')::boolean then
    raise exception 'FAIL: marqueur important (%)', v_day -> 'emails';
  end if;
  raise notice 'OK: marqueur important transmis, absent = faux';
  if jsonb_array_length(v_day #> '{birthdays,today}') <> 2
     or not exists (select 1 from jsonb_array_elements(v_day #> '{birthdays,today}') b
                    where b ->> 'first_name' = 'Marie'
                      and (b ->> 'age')::int = extract(year from v_today)::int - 1999
                      and b ->> 'message' like 'Joyeux anniversaire Marie !%')
     or (v_day #>> '{birthdays,tomorrow,0,name}') <> 'Paul Martin' then
    raise exception 'FAIL: anniversaires (%)', v_day -> 'birthdays';
  end if;
  raise notice 'OK: anniversaires du jour (âge, message) et du lendemain';
  if (v_day #>> '{sync,stale}')::boolean then
    raise exception 'FAIL: synchro fraîche lue comme en panne';
  end if;

  if (select last_viewed_on from public.digest_settings) is not null then
    raise exception 'FAIL: journée vue avant toute consultation';
  end if;
  perform public.mark_my_day_viewed();
  perform public.mark_my_day_viewed();
  if (select last_viewed_on from public.digest_settings) is distinct from v_today then
    raise exception 'FAIL: consultation non datée du jour applicatif';
  end if;
  raise notice 'OK: consultation datée du jour applicatif, idempotente';

  begin
    update public.birthday set name = 'Pirate' where source = 'contacts';
    raise exception 'FAIL: ligne synchronisée modifiable depuis le client';
  exception when raise_exception then
    if sqlerrm <> 'birthday_not_manual' then raise; end if;
    raise notice 'OK: une ligne synchronisée n''est pas modifiable';
  end;

  perform set_config('request.jwt.claims', '{"sub":"' || ub || '","role":"authenticated"}', true);
  v_day := public.get_my_day(null);
  if jsonb_array_length(v_day #> '{events,today}') <> 0 or jsonb_array_length(v_day -> 'emails') <> 0
     or jsonb_array_length(v_day #> '{birthdays,today}') <> 0
     or (select count(*) from public.birthday) <> 0 then
    raise exception 'FAIL: B voit les données de A';
  end if;
  raise notice 'OK: étanchéité A/B sur la journée';
  begin
    perform public.digest_summary(ua, null);
    raise exception 'FAIL: authenticated appelle digest_summary';
  exception when insufficient_privilege then
    raise notice 'OK: digest_summary réservé à service_role';
  end;
  begin
    perform public.claim_due_digests();
    raise exception 'FAIL: authenticated appelle claim_due_digests';
  exception when insufficient_privilege then
    raise notice 'OK: claim_due_digests réservé à service_role';
  end;
  execute 'reset role';

  -- ── Règle du 29 février ────────────────────────────────────────────────────
  if not private.birthday_on(2, 29, date '2027-02-28') or private.birthday_on(2, 29, date '2027-03-01')
     or private.birthday_on(2, 29, date '2028-02-28') or not private.birthday_on(2, 29, date '2028-02-29')
     or not private.birthday_on(2, 29, date '2100-02-28') or not private.birthday_on(2, 29, date '2000-02-29')
     or private.birthday_on(2, 28, date '2027-03-01') then
    raise exception 'FAIL: règle du 29 février';
  end if;
  raise notice 'OK: 29/02 fêté le 28 les années non bissextiles (2100 compris)';

  -- ── Résumé ─────────────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.task (user_id, title, due_date) values
    (ua, 'Aujourd''hui', v_today), (ua, 'Retard 1', v_today - 1), (ua, 'Retard 2', v_today - 3),
    (ua, 'Demain', v_today + 1), (ua, 'Sans date', null);
  execute 'reset role';

  v_res := public.digest_summary(ua, v_today);
  if v_res ->> 'body' <> '3 tâches (dont 2 en retard) · 2 RDV · 2 mails · 🎂 Léa, Marie'
     or v_res ->> 'url' <> '/ma-journee'
     or (v_res ->> 'badge')::int <> 3 then
    raise exception 'FAIL: corps du résumé (%)', v_res;
  end if;
  raise notice 'OK: résumé « % »', v_res ->> 'body';

  insert into private.birthday (user_id, source, name_enc, first_name_enc, month, day)
  select ua, 'manual', private.enc('X ' || i), private.enc('Zoé' || i),
         extract(month from v_today), extract(day from v_today)
  from generate_series(1, 3) i;
  if (public.digest_summary(ua, v_today) ->> 'body') not like '%🎂 Léa, Marie +3' then
    raise exception 'FAIL: plus de deux prénoms (%)', public.digest_summary(ua, v_today) ->> 'body';
  end if;
  raise notice 'OK: deux prénoms au plus, puis +N';

  if public.digest_summary(ub, v_today) ->> 'body' <> 'Rien de prévu aujourd''hui. Bonne journée !' then
    raise exception 'FAIL: journée vide (%)', public.digest_summary(ub, v_today);
  end if;
  if (public.digest_summary(ub, v_today) ->> 'badge')::int <> 0 then
    raise exception 'FAIL: pastille d''une journée vide (%)', public.digest_summary(ub, v_today);
  end if;
  raise notice 'OK: journée vide';

  update private.digest_settings set last_ingest_at = now() - interval '27 hours' where user_id = ua;
  if (public.digest_summary(ua, v_today) ->> 'body') not like '⚠️ Synchro Google interrompue · %' then
    raise exception 'FAIL: synchro en retard non signalée';
  end if;
  raise notice 'OK: synchro de plus de 26 h signalée';

  -- ── Abonnements et réclamation ─────────────────────────────────────────────
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    perform public.register_push_subscription('http://169.254.169.254/latest', 'k', 'a', null);
    raise exception 'FAIL: endpoint arbitraire accepté';
  exception when raise_exception then
    if sqlerrm <> 'push_endpoint_invalid' then raise; end if;
    raise notice 'OK: endpoint hors services push refusé';
  end;
  perform public.register_push_subscription('https://web.push.apple.com/abc', 'p256', 'auth', 'iPhone');
  begin
    execute 'select endpoint from public.push_subscription';
    raise exception 'FAIL: la vue expose l''endpoint';
  exception when undefined_column then
    raise notice 'OK: la vue push_subscription n''expose pas l''endpoint';
  end;
  -- B reprend l'appareil.
  perform set_config('request.jwt.claims', '{"sub":"' || ub || '","role":"authenticated"}', true);
  perform public.register_push_subscription('https://web.push.apple.com/abc', 'p256', 'auth', 'iPhone');
  if (select count(*) from public.push_subscription) <> 1 then
    raise exception 'FAIL: endpoint non réattribué';
  end if;
  perform set_config('request.jwt.claims', '{"sub":"' || ua || '","role":"authenticated"}', true);
  if (select count(*) from public.push_subscription) <> 0 then
    raise exception 'FAIL: A garde un endpoint réattribué';
  end if;
  raise notice 'OK: un endpoint connu est réattribué à l''appelant';
  perform public.register_push_subscription('https://fcm.googleapis.com/fcm/send/xyz', 'p256', 'auth', 'Mac');
  execute 'reset role';

  -- Heure d'envoi passée pour A et B, dans la fenêtre de rattrapage.
  update private.digest_settings
  set send_time = make_time(extract(hour from (now() at time zone private.app_tz()))::int, 0, 0),
      last_sent_on = null
  where user_id in (ua, ub);
  -- Les autres comptes de la base locale ne doivent pas être réclamés par le test.
  update private.digest_settings set last_sent_on = v_today where user_id not in (ua, ub);

  select count(*) into v_n from public.claim_due_digests();
  if v_n <> 2 then
    raise exception 'FAIL: % résumé(s) réclamé(s) au lieu de 2', v_n;
  end if;
  select count(*) into v_n from public.claim_due_digests();
  if v_n <> 0 then
    raise exception 'FAIL: résumé réclamé deux fois le même jour';
  end if;
  raise notice 'OK: un seul résumé par jour et par utilisateur';

  update private.digest_settings set last_sent_on = v_today - 1, enabled = false where user_id = ua;
  select count(*) into v_n from public.claim_due_digests();
  if v_n <> 0 then
    raise exception 'FAIL: résumé désactivé réclamé';
  end if;
  raise notice 'OK: résumé désactivé jamais réclamé';

  raise notice 'TOUS LES TESTS « MA JOURNÉE » PASSENT';
end $$;

rollback;
