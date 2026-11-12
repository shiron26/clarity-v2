-- « Ma journée » (SPEC-MA-JOURNEE §3.2 à §3.5) — 2/6 : les données synchronisées.
--
-- Trois tables remplies par l'instantané du collecteur Google (agenda, mails,
-- anniversaires) et une ligne de réglages par utilisateur. Pattern du dépôt :
-- tables dans `private`, lecture par `public.<x>_rows()` SECURITY DEFINER (le
-- WHERE de la fonction EST la sécurité), vue par-dessus, grants explicites.
--
-- Chiffré (D4) : titres, lieux, noms d'agenda, expéditeurs, objets, noms et
-- téléphones. En clair : dates, booléens, identifiants techniques, et le
-- permalien Gmail (un identifiant de fil, sans contenu).
--
-- Seule `public.birthday` s'écrit depuis le client, et seulement pour les lignes
-- `manual` : la synchro ne les touche jamais, le client ne touche jamais aux
-- siennes.

-- ---------------------------------------------------------------------------
-- Chiffrement à clé lue une fois
-- ---------------------------------------------------------------------------
--
-- `private.enc` / `private.dec` (0001) relisent la clé dans le Vault à CHAQUE
-- appel. C'est sans conséquence pour une tâche, beaucoup pour un instantané :
-- jusqu'à 2 000 anniversaires × 3 champs, toutes les heures, et autant de lectures
-- du Vault. Les fonctions de « Ma journée » lisent donc la clé une fois
-- (`private.app_key()`) et la passent à ces deux variantes. Même confinement que
-- leurs aînées : dans `private`, jamais exécutables par les rôles API.

create or replace function private.enc_k(p text, k text)
returns bytea
language sql stable
set search_path = ''
as $$
  select case when p is null then null else extensions.pgp_sym_encrypt(p, k) end
$$;

create or replace function private.dec_k(p bytea, k text)
returns text
language sql stable
set search_path = ''
as $$
  select case when p is null then null else extensions.pgp_sym_decrypt(p, k) end
$$;

revoke all on function private.enc_k(text, text) from public, anon, authenticated;
revoke all on function private.dec_k(bytea, text) from public, anon, authenticated;

-- Le message d'anniversaire par défaut, défini une fois : défaut de colonne,
-- lecture sans ligne, remise à zéro d'un modèle vide.
create or replace function private.default_birthday_template()
returns text
language sql immutable
set search_path = ''
as $$
  select 'Joyeux anniversaire {prenom} ! 🎉 Je te souhaite une super journée.'::text
$$;

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table private.calendar_event (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profile (id),
  -- `<eventId>@<début ISO>` : distingue les occurrences d'une récurrence.
  source_id         text not null,
  calendar_name_enc bytea not null,
  title_enc         bytea not null,
  location_enc      bytea,
  all_day           boolean not null default false,
  -- Journée entière : minuit (fuseau applicatif) du jour de début / de fin exclusive.
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  ingested_at       timestamptz not null default now(),
  constraint calendar_event_source_uniq unique (user_id, source_id),
  constraint calendar_event_range check (ends_at >= starts_at)
);

alter table private.calendar_event enable row level security;
create index calendar_event_user_start_idx on private.calendar_event (user_id, starts_at);

create or replace function public.calendar_event_rows()
returns table (id uuid, calendar text, title text, location text, all_day boolean,
               starts_at timestamptz, ends_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  with k as (select private.app_key() as key)
  select e.id, private.dec_k(e.calendar_name_enc, k.key), private.dec_k(e.title_enc, k.key),
         private.dec_k(e.location_enc, k.key), e.all_day, e.starts_at, e.ends_at
  from private.calendar_event e, k
  where e.user_id = (select auth.uid())
$$;

revoke all on function public.calendar_event_rows() from public;
revoke all on function public.calendar_event_rows() from anon;
grant execute on function public.calendar_event_rows() to authenticated;

create view public.calendar_event as select * from public.calendar_event_rows();
revoke all on public.calendar_event from anon, authenticated;
grant select on public.calendar_event to authenticated;

-- ---------------------------------------------------------------------------
-- Mails : métadonnées seulement (D5), reflet du dernier instantané
-- ---------------------------------------------------------------------------
--
-- Les non lus de l'onglet Principal (filtre du collecteur). Le marqueur
-- « important » de Gmail n'est pas un filtre : il range chaque mail dans l'une
-- des deux listes de l'écran.

create table private.email (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profile (id),
  source_id      text not null, -- id du fil Gmail
  from_name_enc  bytea not null,
  from_email_enc bytea not null,
  subject_enc    bytea not null,
  received_at    timestamptz not null,
  -- Permalien Gmail. Validé à l'ingestion (https://mail.google.com/ seulement) :
  -- le client en fait un lien, et un jeton volé ne doit pas pouvoir y glisser
  -- un `javascript:`.
  url            text,
  -- Le marqueur « important » de Gmail, en clair comme `all_day`.
  is_important   boolean not null default false,
  ingested_at    timestamptz not null default now(),
  constraint email_source_uniq unique (user_id, source_id)
);

alter table private.email enable row level security;

create or replace function public.email_rows()
returns table (id uuid, from_name text, from_email text, subject text,
               received_at timestamptz, url text, is_important boolean)
language sql stable security definer
set search_path = ''
as $$
  with k as (select private.app_key() as key)
  select m.id, private.dec_k(m.from_name_enc, k.key), private.dec_k(m.from_email_enc, k.key),
         private.dec_k(m.subject_enc, k.key), m.received_at, m.url, m.is_important
  from private.email m, k
  where m.user_id = (select auth.uid())
$$;

revoke all on function public.email_rows() from public;
revoke all on function public.email_rows() from anon;
grant execute on function public.email_rows() to authenticated;

create view public.email as select * from public.email_rows();
revoke all on public.email from anon, authenticated;
grant select on public.email to authenticated;

-- ---------------------------------------------------------------------------
-- Anniversaires : contacts, agenda (synchro) et manuel (Clarity)
-- ---------------------------------------------------------------------------

create table private.birthday (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profile (id),
  source         text not null check (source in ('contacts', 'calendar', 'manual')),
  source_id      text,
  name_enc       bytea not null,
  first_name_enc bytea not null,
  -- Chiffres seuls, format international sans « + » (ex. 33612345678).
  phone_enc      bytea,
  month          smallint not null check (month between 1 and 12),
  day            smallint not null,
  year           smallint check (year between 1900 and 2100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Le 29/02 est une date valide : il se fête le 28 les années non bissextiles
  -- (`private.birthday_on`, migration day_read).
  constraint birthday_day_valid check (
    day >= 1 and day <= case month when 2 then 29 when 4 then 30 when 6 then 30
                                   when 9 then 30 when 11 then 30 else 31 end
  ),
  -- Une ligne synchronisée a un identifiant de source, une ligne manuelle n'en a pas.
  constraint birthday_source_id_shape check ((source = 'manual') = (source_id is null)),
  constraint birthday_source_uniq unique (user_id, source, source_id)
);

alter table private.birthday enable row level security;
create index birthday_user_date_idx on private.birthday (user_id, month, day);

create or replace function public.birthday_rows()
returns table (id uuid, source text, name text, first_name text, phone text,
               month smallint, day smallint, year smallint,
               created_at timestamptz, updated_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  with k as (select private.app_key() as key)
  select b.id, b.source, private.dec_k(b.name_enc, k.key), private.dec_k(b.first_name_enc, k.key),
         private.dec_k(b.phone_enc, k.key), b.month, b.day, b.year, b.created_at, b.updated_at
  from private.birthday b, k
  where b.user_id = (select auth.uid())
$$;

revoke all on function public.birthday_rows() from public;
revoke all on function public.birthday_rows() from anon;
grant execute on function public.birthday_rows() to authenticated;

create view public.birthday as select * from public.birthday_rows();
revoke all on public.birthday from anon, authenticated;
grant select, insert, update, delete on public.birthday to authenticated;

-- Écriture : lignes `manual` uniquement. `source`, `user_id`, `created_at` et
-- `updated_at` sont imposés par le serveur et assignés à NEW (RETURNING fidèle).
create or replace function private.birthday_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_name  text;
  v_first text;
  v_key   text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if not exists (select 1 from private.birthday b
                   where b.id = old.id and b.user_id = v_user and b.source = 'manual') then
      raise exception 'birthday_not_manual';
    end if;
  end if;

  if tg_op = 'DELETE' then
    delete from private.birthday where id = old.id;
    return old;
  end if;

  v_name := nullif(btrim(coalesce(new.name, '')), '');
  if v_name is null then
    raise exception 'birthday_name_required';
  end if;
  v_name := left(v_name, 300);
  v_first := left(coalesce(nullif(btrim(coalesce(new.first_name, '')), ''),
                           split_part(v_name, ' ', 1)), 300);

  -- Même règle que la contrainte, mais en P0001 : une violation de CHECK
  -- (23514) se lirait « erreur de notre côté ».
  if new.month is null or new.day is null or new.month not between 1 and 12
     or new.day < 1
     -- Parenthèses obligatoires : sans elles, le IF de PL/pgSQL s'arrête au
     -- premier THEN, celui du CASE.
     or new.day > (case new.month when 2 then 29 when 4 then 30 when 6 then 30
                                  when 9 then 30 when 11 then 30 else 31 end)
     or (new.year is not null and new.year not between 1900 and 2100) then
    raise exception 'birthday_date_invalid';
  end if;

  if new.phone is not null and new.phone !~ '^\d{8,15}$' then
    raise exception 'birthday_phone_invalid';
  end if;

  v_key := private.app_key();
  if tg_op = 'INSERT' then
    if v_user is null then
      raise exception 'not_authenticated';
    end if;
    insert into private.birthday (user_id, source, source_id, name_enc, first_name_enc,
                                  phone_enc, month, day, year)
    values (v_user, 'manual', null, private.enc_k(v_name, v_key), private.enc_k(v_first, v_key),
            private.enc_k(new.phone, v_key), new.month, new.day, new.year)
    returning id, created_at, updated_at into new.id, new.created_at, new.updated_at;
  else
    update private.birthday
    set name_enc = private.enc_k(v_name, v_key),
        first_name_enc = private.enc_k(v_first, v_key),
        phone_enc = private.enc_k(new.phone, v_key),
        month = new.month, day = new.day, year = new.year,
        updated_at = now()
    where id = old.id
    returning id, created_at, updated_at into new.id, new.created_at, new.updated_at;
  end if;

  new.source := 'manual';
  new.name := v_name;
  new.first_name := v_first;
  return new;
end;
$$;

revoke all on function private.birthday_view_iiud() from public;

create trigger birthday_iiud
instead of insert or update or delete on public.birthday
for each row execute function private.birthday_view_iiud();

-- ---------------------------------------------------------------------------
-- Réglages : une ligne par utilisateur, créée à la volée
-- ---------------------------------------------------------------------------

create table private.digest_settings (
  user_id                   uuid primary key references public.profile (id),
  enabled                   boolean not null default true,
  -- Heure du fuseau applicatif, par pas de 15 min.
  send_time                 time not null default '07:30',
  birthday_message_template text not null default private.default_birthday_template(),
  last_sent_on              date, -- jour applicatif du dernier résumé envoyé
  last_ingest_at            timestamptz,
  -- Jour applicatif de la dernière ouverture de « Ma journée » : le bouton du
  -- dashboard s'éteint ensuite. Posé par le serveur (`mark_my_day_viewed`),
  -- jamais par l'horloge du navigateur — d'où aucun grant d'écriture.
  last_viewed_on            date,
  -- Empreinte (HMAC sous la clé applicative) de la section `birthdays` du dernier
  -- instantané : inchangée, l'ingestion ne réécrit pas les anniversaires. Clé
  -- secrète, donc l'empreinte ne permet pas de deviner des noms. Jamais exposée.
  birthdays_digest          bytea,
  constraint digest_send_time_quarter check (
    extract(minute from send_time)::int % 15 = 0 and extract(second from send_time) = 0
  ),
  constraint digest_template_len check (char_length(birthday_message_template) between 1 and 500)
);

alter table private.digest_settings enable row level security;

-- Toujours une ligne, même avant la première écriture : les défauts s'y lisent.
create or replace function public.digest_settings_rows()
returns table (enabled boolean, send_time time, birthday_message_template text,
               last_sent_on date, last_ingest_at timestamptz, last_viewed_on date)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(s.enabled, true),
         coalesce(s.send_time, '07:30'::time),
         coalesce(s.birthday_message_template, private.default_birthday_template()),
         s.last_sent_on, s.last_ingest_at, s.last_viewed_on
  from (select (select auth.uid()) as uid) u
  left join private.digest_settings s on s.user_id = u.uid
  where u.uid is not null
$$;

revoke all on function public.digest_settings_rows() from public;
revoke all on function public.digest_settings_rows() from anon;
grant execute on function public.digest_settings_rows() to authenticated;

create view public.digest_settings as select * from public.digest_settings_rows();
revoke all on public.digest_settings from anon, authenticated;
grant select on public.digest_settings to authenticated;

-- Paramètre null = valeur inchangée. L'heure est ramenée au quart d'heure
-- inférieur ; un modèle vide revient au défaut.
create or replace function public.update_digest_settings(
  p_enabled boolean default null,
  p_send_time time default null,
  p_birthday_message_template text default null
)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_time time;
  v_tpl  text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_send_time is not null then
    v_time := make_time(extract(hour from p_send_time)::int,
                        (extract(minute from p_send_time)::int / 15) * 15, 0);
  end if;

  if p_birthday_message_template is not null then
    v_tpl := btrim(p_birthday_message_template);
    if char_length(v_tpl) > 500 then
      raise exception 'digest_template_too_long';
    end if;
    if v_tpl = '' then
      v_tpl := private.default_birthday_template();
    end if;
  end if;

  insert into private.digest_settings (user_id) values (v_user)
  on conflict (user_id) do nothing;

  update private.digest_settings
  set enabled = coalesce(p_enabled, enabled),
      send_time = coalesce(v_time, send_time),
      birthday_message_template = coalesce(v_tpl, birthday_message_template)
  where user_id = v_user;
end;
$$;

revoke all on function public.update_digest_settings(boolean, time, text) from public;
revoke all on function public.update_digest_settings(boolean, time, text) from anon;
grant execute on function public.update_digest_settings(boolean, time, text) to authenticated;

-- Ouvrir « Ma journée » éteint le bouton du dashboard, sur tous les appareils.
-- Idempotente dans la journée.
create or replace function public.mark_my_day_viewed()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  insert into private.digest_settings (user_id, last_viewed_on)
  values (v_user, private.today())
  on conflict (user_id) do update set last_viewed_on = private.today();
end;
$$;

revoke all on function public.mark_my_day_viewed() from public;
revoke all on function public.mark_my_day_viewed() from anon;
grant execute on function public.mark_my_day_viewed() to authenticated;
