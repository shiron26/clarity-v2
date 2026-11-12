-- « Ma journée » (SPEC-MA-JOURNEE §4.5) — 4/6 : la lecture de la journée.
--
-- `public.get_my_day(p_date)` rend en un aller-retour l'agenda, les mails et les
-- anniversaires du jour (et du lendemain), plus l'état de la synchro.
--
-- Écart assumé avec la spec : les TÂCHES n'y sont pas. La vue « Aujourd'hui » de
-- /taches est un prédicat CLIENT (`matchesScope` / `inOverdueScope`,
-- src/features/tasks/taskScope.ts) sur `useTasks('all')` ; la recopier ici en SQL
-- la ferait diverger au premier changement. L'écran « Ma journée » lit donc les
-- tâches par les mêmes hooks, donc les mêmes query keys : zéro appel en plus, et
-- cocher passe par les mutations existantes.
--
-- SECURITY DEFINER plutôt qu'INVOKER (spec) : la fonction a besoin du fuseau et
-- du déchiffrement, tous deux dans `private`, que les rôles API ne voient pas.
-- Le WHERE sur `auth.uid()` EST la sécurité, comme pour les `_rows()`.
--
-- Le défaut de `p_date` est null puis `private.today()` dans le corps : une
-- expression par défaut est évaluée avec les droits de l'APPELANT, qui n'a pas
-- accès à `private`.

-- ---------------------------------------------------------------------------
-- Règle du 29 février : fêté le 28 les années non bissextiles (§3.4)
-- ---------------------------------------------------------------------------

create or replace function private.birthday_on(p_month int, p_day int, p_date date)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case
    when p_month = 2 and p_day = 29
         and not (extract(year from p_date)::int % 4 = 0
                  and (extract(year from p_date)::int % 100 <> 0
                       or extract(year from p_date)::int % 400 = 0))
      then extract(month from p_date) = 2 and extract(day from p_date) = 28
    else extract(month from p_date) = p_month and extract(day from p_date) = p_day
  end
$$;

-- Synchro en panne (D12) : plus de 26 h sans ingestion. Jamais synchronisé
-- n'est PAS « en panne » : sans collecteur installé, l'alerte serait du bruit.
create or replace function private.sync_is_stale(p_last_ingest_at timestamptz)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_last_ingest_at is not null and p_last_ingest_at < now() - interval '26 hours'
$$;

-- Événements d'un jour applicatif : chevauchement de [jour 00:00, jour+1 00:00).
-- Journées entières d'abord, puis par heure de début.
-- Début d'un jour applicatif, en instant : la borne d'une fenêtre de journée.
-- `public.app_day_start()` (migration app_day_start) en est le cas d'aujourd'hui.
create or replace function private.day_start(p_date date)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select p_date::timestamp at time zone private.app_tz()
$$;

-- Un événement est du jour s'il chevauche [début du jour, début du lendemain).
-- Seule définition : la lecture (`day_events`) et le résumé (`digest_summary`)
-- comptent les mêmes rendez-vous.
create or replace function private.event_on(e private.calendar_event, p_date date)
returns boolean
language sql stable
set search_path = ''
as $$
  select e.starts_at < private.day_start(p_date + 1) and e.ends_at > private.day_start(p_date)
$$;

-- Événements d'un jour applicatif. `p_key` : la clé lue une fois par l'appelant.
create or replace function private.day_events(p_user uuid, p_date date, p_key text)
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', private.dec_k(e.title_enc, p_key),
           'calendar', private.dec_k(e.calendar_name_enc, p_key),
           'location', private.dec_k(e.location_enc, p_key),
           'all_day', e.all_day,
           'starts_at', e.starts_at,
           'ends_at', e.ends_at,
           -- Heures déjà lues dans le fuseau applicatif : le client ne le connaît
           -- pas (AGENTS.md, « Dates »), il ne doit pas formater lui-même.
           'start_time', to_char(e.starts_at at time zone private.app_tz(), 'HH24:MI'),
           'end_time', to_char(e.ends_at at time zone private.app_tz(), 'HH24:MI'))
         order by e.all_day desc, e.starts_at, e.ends_at), '[]'::jsonb)
  from private.calendar_event e
  where e.user_id = p_user and private.event_on(e, p_date)
$$;

create or replace function public.get_my_day(p_date date default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_date     date := coalesce(p_date, private.today());
  v_settings record;
  -- Clé lue UNE fois pour toute la journée (voir `private.dec_k`, day_sources).
  v_key      text := private.app_key();
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_settings from public.digest_settings_rows();

  return jsonb_build_object(
    'date', v_date,
    -- L'heure exacte de la synchro se lit dans les réglages : l'écran n'a besoin
    -- que de savoir si elle est en panne.
    'sync', jsonb_build_object('stale', private.sync_is_stale(v_settings.last_ingest_at)),
    'events', jsonb_build_object(
      'today', private.day_events(v_user, v_date, v_key),
      'tomorrow', private.day_events(v_user, v_date + 1, v_key)),
    -- Ni l'adresse de l'expéditeur (l'écran ne la montre pas : autant ne pas la
    -- déchiffrer), ni le corps, qui n'est jamais stocké.
    'emails', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'from_name', private.dec_k(m.from_name_enc, v_key),
               'subject', private.dec_k(m.subject_enc, v_key),
               'received_at', m.received_at,
               'received_on', private.app_day(m.received_at),
               'received_time', to_char(m.received_at at time zone private.app_tz(), 'HH24:MI'),
               'url', m.url,
               'important', m.is_important)
             order by m.received_at desc), '[]'::jsonb)
      from private.email m
      where m.user_id = v_user),
    'birthdays', jsonb_build_object(
      'today', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', x.id, 'name', x.name, 'first_name', x.first_name,
                 'age', x.age, 'phone', x.phone,
                 'message', replace(v_settings.birthday_message_template, '{prenom}', x.first_name))
               order by x.name), '[]'::jsonb)
        from (
          select b.id, private.dec_k(b.name_enc, v_key) as name,
                 private.dec_k(b.first_name_enc, v_key) as first_name,
                 private.dec_k(b.phone_enc, v_key) as phone,
                 extract(year from v_date)::int - b.year as age
          from private.birthday b
          -- Le filtre sur le mois sert l'index (user_id, month, day) : la règle du
          -- 29/02 reste dans le même mois, il ne retire donc rien.
          where b.user_id = v_user and b.month = extract(month from v_date)
            and private.birthday_on(b.month, b.day, v_date)
        ) x),
      'tomorrow', (
        select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'age', x.age)
               order by x.name), '[]'::jsonb)
        from (
          select b.id, private.dec_k(b.name_enc, v_key) as name,
                 extract(year from v_date + 1)::int - b.year as age
          from private.birthday b
          where b.user_id = v_user and b.month = extract(month from v_date + 1)
            and private.birthday_on(b.month, b.day, v_date + 1)
        ) x))
  );
end;
$$;

revoke all on function public.get_my_day(date) from public;
revoke all on function public.get_my_day(date) from anon;
grant execute on function public.get_my_day(date) to authenticated;
