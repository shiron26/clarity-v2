-- « Ma journée » (SPEC-MA-JOURNEE §4.1) — 3/6 : l'ingestion de l'instantané Google.
--
-- `public.ingest_daily_snapshot(p_token, p_payload)` est la SEULE surface du
-- dépôt exécutable par `anon` : le collecteur (Apps Script) n'a pas de session.
-- Elle est protégée par :
--   · un jeton personnel, retrouvé par son empreinte, jamais stocké en clair ;
--   · une erreur générique (`invalid token`) qui ne dit pas si le jeton est
--     inconnu, révoqué, ou si le compte est supprimé ;
--   · une validation stricte (§4.1) : la moindre règle violée rejette TOUT le
--     payload (`invalid_payload: <règle>`), sauf le téléphone, mis à null ;
--   · un périmètre d'écriture borné à l'utilisateur du jeton, et jamais aux
--     lignes `manual`.
--
-- Instantané à remplacement (D3) : les événements qui chevauchent la fenêtre
-- envoyée, tous les mails et tous les anniversaires synchronisés sont remplacés.
-- Deux envois identiques laissent donc exactement le même contenu. La RPC est
-- une seule transaction (un appel PostgREST l'est toujours).
--
-- Le fuseau est celui de l'application (`private.app_tz()`), jamais celui que
-- déclare le payload : `timezone` n'y est qu'un champ informatif.

create or replace function public.ingest_daily_snapshot(p_token text, p_payload jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_tz        text := private.app_tz();
  v_token_id  uuid;
  v_user      uuid;
  v_start     timestamptz;
  v_end       timestamptz;
  v_events    jsonb;
  v_emails    jsonb;
  v_birthdays jsonb;
  n_events    int;
  n_emails    int;
  n_birthdays int;
  -- Clé lue UNE fois pour tout l'instantané (voir `private.enc_k`, day_sources).
  v_key       text;
  v_bday_hash bytea;
  v_bday_prev bytea;
begin
  -- 1. Le jeton -------------------------------------------------------------
  if p_token is null or char_length(p_token) > 200 then
    raise exception 'invalid token';
  end if;

  select t.id, t.user_id into v_token_id, v_user
  from private.ingest_token t
  join public.profile p on p.id = t.user_id and p.deleted_at is null
  where t.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null;

  if v_user is null then
    raise exception 'invalid token';
  end if;

  v_key := private.app_key();

  -- 2. La forme ---------------------------------------------------------------
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'invalid_payload: not_an_object';
  end if;
  if p_payload -> 'version' is distinct from '1'::jsonb then
    raise exception 'invalid_payload: version';
  end if;

  v_events    := coalesce(p_payload -> 'events', '[]'::jsonb);
  v_emails    := coalesce(p_payload -> 'emails', '[]'::jsonb);
  v_birthdays := coalesce(p_payload -> 'birthdays', '[]'::jsonb);

  if jsonb_typeof(v_events) <> 'array' or jsonb_typeof(v_emails) <> 'array'
     or jsonb_typeof(v_birthdays) <> 'array' then
    raise exception 'invalid_payload: not_an_array';
  end if;
  if jsonb_array_length(v_events) > 200 then
    raise exception 'invalid_payload: too_many_events';
  end if;
  if jsonb_array_length(v_emails) > 50 then
    raise exception 'invalid_payload: too_many_emails';
  end if;
  if jsonb_array_length(v_birthdays) > 2000 then
    raise exception 'invalid_payload: too_many_birthdays';
  end if;

  -- Un format de date illisible lève une erreur de conversion (22xxx) au milieu
  -- d'un insert : le bloc la ramène au même message que les autres règles.
  begin
    v_start := (p_payload #>> '{window,start}')::timestamptz;
    v_end   := (p_payload #>> '{window,end}')::timestamptz;
    if v_start is null or v_end is null or v_end <= v_start
       or v_end - v_start > interval '3 days' then
      raise exception 'invalid_payload: window';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_events) e
      where jsonb_typeof(e) <> 'object'
         or nullif(e ->> 'source_id', '') is null
         or e ->> 'start' is null or e ->> 'end' is null
    ) then
      raise exception 'invalid_payload: event';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_emails) m
      where jsonb_typeof(m) <> 'object'
         or nullif(m ->> 'source_id', '') is null
         or m ->> 'received_at' is null
    ) then
      raise exception 'invalid_payload: email';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_birthdays) b
      where jsonb_typeof(b) <> 'object'
         or nullif(b ->> 'source_id', '') is null
         or nullif(btrim(b ->> 'name'), '') is null
         or coalesce(b ->> 'source', '') not in ('contacts', 'calendar')
         or (b ->> 'month')::int not between 1 and 12
         or (b ->> 'day')::int not between 1 and 31
    ) then
      raise exception 'invalid_payload: birthday';
    end if;

    -- 3. Agenda : remplacement de la fenêtre --------------------------------
    delete from private.calendar_event
    where user_id = v_user and starts_at < v_end and ends_at > v_start;
    -- Hygiène : ce qui est fini depuis une semaine ne sert plus à rien.
    delete from private.calendar_event
    where user_id = v_user and ends_at < now() - interval '7 days';

    insert into private.calendar_event (user_id, source_id, calendar_name_enc, title_enc,
                                        location_enc, all_day, starts_at, ends_at)
    select distinct on (x.source_id)
           v_user, x.source_id,
           private.enc_k(x.calendar, v_key), private.enc_k(x.title, v_key),
           private.enc_k(x.location, v_key),
           x.all_day, x.starts_at, x.ends_at
    from (
      select left(e ->> 'source_id', 300) as source_id,
             left(coalesce(nullif(e ->> 'calendar', ''), 'Agenda'), 300) as calendar,
             left(coalesce(nullif(e ->> 'title', ''), '(sans titre)'), 300) as title,
             left(nullif(e ->> 'location', ''), 300) as location,
             coalesce((e ->> 'all_day')::boolean, false) as all_day,
             -- Journée entière : "YYYY-MM-DD" → minuit du fuseau applicatif.
             case when coalesce((e ->> 'all_day')::boolean, false)
                  then ((e ->> 'start')::date)::timestamp at time zone v_tz
                  else (e ->> 'start')::timestamptz end as starts_at,
             case when coalesce((e ->> 'all_day')::boolean, false)
                  then ((e ->> 'end')::date)::timestamp at time zone v_tz
                  else (e ->> 'end')::timestamptz end as ends_at
      from jsonb_array_elements(v_events) e
    ) x
    where x.ends_at >= x.starts_at
    order by x.source_id
    -- Un événement hors fenêtre déjà connu (déplacé, fenêtre décalée) garde son
    -- identifiant : on le met à jour au lieu de lever une violation d'unicité.
    on conflict (user_id, source_id) do update
      set calendar_name_enc = excluded.calendar_name_enc,
          title_enc = excluded.title_enc,
          location_enc = excluded.location_enc,
          all_day = excluded.all_day,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          ingested_at = now();
    get diagnostics n_events = row_count;

    -- 4. Mails : remplacement total -----------------------------------------
    delete from private.email where user_id = v_user;

    insert into private.email (user_id, source_id, from_name_enc, from_email_enc,
                               subject_enc, received_at, url, is_important)
    select distinct on (x.source_id)
           v_user, x.source_id, private.enc_k(x.from_name, v_key),
           private.enc_k(x.from_email, v_key), private.enc_k(x.subject, v_key),
           x.received_at, x.url, x.is_important
    from (
      select left(m ->> 'source_id', 300) as source_id,
             left(coalesce(nullif(m ->> 'from_name', ''), nullif(m ->> 'from_email', ''), '?'), 300) as from_name,
             left(coalesce(m ->> 'from_email', ''), 300) as from_email,
             left(coalesce(nullif(m ->> 'subject', ''), '(sans objet)'), 300) as subject,
             (m ->> 'received_at')::timestamptz as received_at,
             case when m ->> 'url' ~ '^https://mail\.google\.com/' and char_length(m ->> 'url') <= 500
                  then m ->> 'url' end as url,
             -- Facultatif : absent (collecteur plus ancien) = pas important.
             coalesce((m ->> 'important')::boolean, false) as is_important
      from jsonb_array_elements(v_emails) m
    ) x
    order by x.source_id;
    get diagnostics n_emails = row_count;

    -- 5. Anniversaires synchronisés : remplacement total, `manual` intactes ----
    --
    -- Une liste de contacts ne bouge presque jamais d'une heure à l'autre : la
    -- section inchangée (même empreinte que le dernier instantané accepté) n'est
    -- pas réécrite. Sans ce court-circuit, chaque passage rechiffrait jusqu'à
    -- 2 000 × 3 champs pour reposer les mêmes valeurs. L'empreinte est un HMAC
    -- sous la clé applicative : elle ne permet pas de deviner un nom.
    v_bday_hash := extensions.hmac(v_birthdays::text, v_key, 'sha256');
    select s.birthdays_digest into v_bday_prev
    from private.digest_settings s where s.user_id = v_user;

    if v_bday_prev is not distinct from v_bday_hash then
      select count(*) into n_birthdays from private.birthday
      where user_id = v_user and source in ('contacts', 'calendar');
    else
      delete from private.birthday
      where user_id = v_user and source in ('contacts', 'calendar');

      insert into private.birthday (user_id, source, source_id, name_enc, first_name_enc,
                                    phone_enc, month, day, year)
      select distinct on (x.source, x.source_id)
             v_user, x.source, x.source_id, private.enc_k(x.name, v_key),
             private.enc_k(x.first_name, v_key), private.enc_k(x.phone, v_key),
             x.month, x.day, x.year
      from (
        select b ->> 'source' as source,
               left(b ->> 'source_id', 300) as source_id,
               left(btrim(b ->> 'name'), 300) as name,
               left(coalesce(nullif(btrim(b ->> 'first_name'), ''),
                             split_part(btrim(b ->> 'name'), ' ', 1)), 300) as first_name,
               -- Invalide → null, sans rejeter le payload (§4.1).
               case when b ->> 'phone' ~ '^\d{8,15}$' then b ->> 'phone' end as phone,
               (b ->> 'month')::smallint as month,
               (b ->> 'day')::smallint as day,
               case when (b ->> 'year')::int between 1900 and 2100
                    then (b ->> 'year')::smallint end as year
        from jsonb_array_elements(v_birthdays) b
      ) x
      -- Un 31/04 passe la règle du payload (jour entre 1 et 31) mais n'existe pas :
      -- on l'écarte plutôt que de rejeter les 1 999 autres.
      where x.day <= case x.month when 2 then 29 when 4 then 30 when 6 then 30
                                  when 9 then 30 when 11 then 30 else 31 end
      order by x.source, x.source_id;
      get diagnostics n_birthdays = row_count;
    end if;

  exception
    when invalid_datetime_format or datetime_field_overflow or invalid_text_representation
         or numeric_value_out_of_range or invalid_parameter_value then
      raise exception 'invalid_payload: format';
  end;

  -- 6. Traces -------------------------------------------------------------------
  insert into private.digest_settings (user_id, last_ingest_at, birthdays_digest)
  values (v_user, now(), v_bday_hash)
  on conflict (user_id) do update
    set last_ingest_at = now(), birthdays_digest = excluded.birthdays_digest;

  update private.ingest_token set last_used_at = now() where id = v_token_id;

  return jsonb_build_object('ok', true, 'events', n_events,
                            'emails', n_emails, 'birthdays', n_birthdays);
end;
$$;

revoke all on function public.ingest_daily_snapshot(text, jsonb) from public;
revoke all on function public.ingest_daily_snapshot(text, jsonb) from authenticated;
-- Le seul grant à `anon` du dépôt. Voir l'en-tête.
grant execute on function public.ingest_daily_snapshot(text, jsonb) to anon;
