-- « Ma journée » (SPEC-MA-JOURNEE §3.6, §4.3, §4.6, §5.2) — 5/6 : Web Push et résumé.
--
-- Côté utilisateur : enregistrer / retirer l'abonnement push de chaque appareil.
-- Côté envoi (Edge Function `send-digests`, rôle `service_role` UNIQUEMENT) :
-- réclamer les résumés dus, lire les abonnements, signaler les morts.
--
-- Un endpoint push est une URL que l'Edge Function va appeler en POST. Accepter
-- n'importe laquelle ferait de la fonction un relais de requêtes vers ce qu'un
-- utilisateur choisit (SSRF) : l'endpoint est donc restreint en HTTPS aux
-- services push des navigateurs (Apple, Google, Mozilla, Microsoft).

create table private.push_subscription (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profile (id),
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

alter table private.push_subscription enable row level security;
create index push_subscription_user_idx on private.push_subscription (user_id);

create or replace function private.push_endpoint_is_valid(p text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select char_length(p) <= 1000 and p ~ ('^https://('
    'fcm\.googleapis\.com'
    '|updates\.push\.services\.mozilla\.com'
    '|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com'
    '|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com'
    ')/')
$$;

-- ---------------------------------------------------------------------------
-- Côté utilisateur
-- ---------------------------------------------------------------------------

-- Jamais l'endpoint ni les clés : ils suffisent à pousser vers l'appareil.
create or replace function public.push_subscription_rows()
returns table (id uuid, user_agent text, created_at timestamptz, last_success_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select s.id, s.user_agent, s.created_at, s.last_success_at
  from private.push_subscription s
  where s.user_id = (select auth.uid())
$$;

revoke all on function public.push_subscription_rows() from public;
revoke all on function public.push_subscription_rows() from anon;
grant execute on function public.push_subscription_rows() to authenticated;

create view public.push_subscription as select * from public.push_subscription_rows();
revoke all on public.push_subscription from anon, authenticated;
grant select on public.push_subscription to authenticated;

-- Upsert par endpoint. Un endpoint déjà connu pour un autre utilisateur lui est
-- réattribué (appareil partagé, reconnexion) : c'est l'appareil qui décide à
-- qui il appartient, puisque c'est lui qui a produit l'abonnement.
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
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
  if p_endpoint is null or not private.push_endpoint_is_valid(p_endpoint) then
    raise exception 'push_endpoint_invalid';
  end if;
  if nullif(p_p256dh, '') is null or nullif(p_auth, '') is null
     or char_length(p_p256dh) > 200 or char_length(p_auth) > 100 then
    raise exception 'push_endpoint_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('push_subscription:' || v_user::text, 0));
  if (select count(*) from private.push_subscription s
      where s.user_id = v_user and s.endpoint <> p_endpoint) >= 10 then
    raise exception 'push_subscription_cap';
  end if;

  insert into private.push_subscription (user_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent;

  -- La ligne de réglages naît au premier abonnement : c'est elle que le cron
  -- parcourt (défauts : activé, 07:30).
  insert into private.digest_settings (user_id) values (v_user)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public;
revoke all on function public.register_push_subscription(text, text, text, text) from anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from private.push_subscription
  where endpoint = p_endpoint and user_id = (select auth.uid())
$$;

revoke all on function public.unregister_push_subscription(text) from public;
revoke all on function public.unregister_push_subscription(text) from anon;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- Retirer un AUTRE appareil depuis les réglages : la vue n'expose pas l'endpoint.
create or replace function public.remove_push_subscription(p_id uuid)
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from private.push_subscription
  where id = p_id and user_id = (select auth.uid())
$$;

revoke all on function public.remove_push_subscription(uuid) from public;
revoke all on function public.remove_push_subscription(uuid) from anon;
grant execute on function public.remove_push_subscription(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Le résumé (§4.6)
-- ---------------------------------------------------------------------------

-- Les espaces dont un utilisateur est membre ACTIF : la définition unique de
-- l'appartenance. `public.is_space_member` (0003, qui sert toutes les policies et
-- `task_rows()`) s'appuie désormais dessus pour l'utilisateur courant ; le résumé,
-- qui tourne sans session, l'appelle pour un utilisateur donné. Sans elle, la
-- règle aurait une cinquième copie ici, et le résumé pourrait compter une tâche
-- que l'écran cache.
create or replace function private.active_space_ids(p_user uuid)
returns setof uuid
language sql stable
set search_path = ''
as $$
  select m.space_id from public.space_member m
  where m.user_id = p_user and m.left_at is null
$$;

revoke all on function private.active_space_ids(uuid) from public, anon, authenticated;

-- Même signature, même sémantique qu'en 0003 : seul le corps délègue. Les grants
-- d'une fonction survivent à `create or replace`.
create or replace function public.is_space_member(p_space uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.active_space_ids((select auth.uid())) s where s = p_space
  )
$$;

-- Compteurs de tâches d'un utilisateur pour un jour donné. MIROIR SERVEUR de
-- `isDueOn` / `isPastDue` (src/lib/taskDay.ts, la règle de « Ma journée ») : tâches
-- visibles (les siennes et celles de ses espaces, comme `public.task_rows()`),
-- non cochées, dues ce jour-là ou en retard. Toute évolution de ces prédicats
-- côté client doit être reportée ici.
--
-- `= any(array(...))` plutôt qu'un `exists` corrélé : la liste des espaces est
-- calculée une fois, et chaque branche du OR peut servir son index
-- (`task_user_due_idx`, `task_space_due_idx`) au lieu d'un parcours de toutes les
-- tâches ouvertes de tous les utilisateurs.
create or replace function private.day_task_counts(p_user uuid, p_date date)
returns table (due_today int, overdue int)
language sql stable
set search_path = ''
as $$
  select count(*) filter (where t.due_date = p_date)::int,
         count(*) filter (where t.due_date < p_date)::int
  from private.task t
  where t.completed_at is null
    and t.due_date <= p_date
    and (t.user_id = p_user
         or t.space_id = any (array(select private.active_space_ids(p_user))))
$$;

-- Les cibles push d'un utilisateur, telles que l'Edge Function les attend.
create or replace function private.push_targets(p_user uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', ps.id, 'endpoint', ps.endpoint,
                                               'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
  from private.push_subscription ps
  where ps.user_id = p_user
$$;

revoke all on function private.push_targets(uuid) from public, anon, authenticated;

create or replace function public.digest_summary(p_user_id uuid, p_date date default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_date    date := coalesce(p_date, private.today());
  v_tasks   record;
  v_events  int;
  v_emails  int;
  v_names   text[];
  v_total_b int;
  v_parts   text[] := '{}';
  v_body    text;
  v_n       int;
  v_key     text := private.app_key();
begin
  select * into v_tasks from private.day_task_counts(p_user_id, v_date);
  v_n := v_tasks.due_today + v_tasks.overdue;
  if v_n > 0 then
    v_parts := v_parts || (v_n || case when v_n > 1 then ' tâches' else ' tâche' end
      || case when v_tasks.overdue > 0 then ' (dont ' || v_tasks.overdue || ' en retard)' else '' end);
  end if;

  select count(*) into v_events
  from private.calendar_event e
  where e.user_id = p_user_id and private.event_on(e, v_date);
  if v_events > 0 then
    v_parts := v_parts || (v_events || ' RDV');
  end if;

  -- Tous les mails non lus remontés, importants ou non : l'écran les montre tous.
  select count(*) into v_emails from private.email m where m.user_id = p_user_id;
  if v_emails > 0 then
    v_parts := v_parts || (v_emails || case when v_emails > 1 then ' mails' else ' mail' end);
  end if;

  select array_agg(x.first_name order by x.first_name), count(*)
  into v_names, v_total_b
  from (
    select left(private.dec_k(b.first_name_enc, v_key), 40) as first_name
    from private.birthday b
    where b.user_id = p_user_id and b.month = extract(month from v_date)
      and private.birthday_on(b.month, b.day, v_date)
  ) x;
  if v_total_b > 0 then
    v_parts := v_parts || ('🎂 ' || array_to_string(v_names[1:2], ', ')
      || case when v_total_b > 2 then ' +' || (v_total_b - 2) else '' end);
  end if;

  v_body := case when cardinality(v_parts) = 0
                 then 'Rien de prévu aujourd''hui. Bonne journée !'
                 else array_to_string(v_parts, ' · ') end;

  if private.sync_is_stale((select s.last_ingest_at from private.digest_settings s
                            where s.user_id = p_user_id)) then
    v_body := '⚠️ Synchro Google interrompue · ' || v_body;
  end if;

  -- Bien sous les 3 Ko du payload Web Push : chaque rubrique est un compteur,
  -- seuls deux prénoms (tronqués) sont du texte libre.
  -- « Votre journée » et non « Ta journée » (spec) : le produit vouvoie.
  --
  -- `badge` : le même compte que la rubrique des tâches, que le service worker
  -- pose en pastille sur l'icône de l'app. Un nombre, jamais un titre : la
  -- pastille vit dans l'OS, hors de portée du chiffrement.
  return jsonb_build_object('title', '☀️ Votre journée', 'body', left(v_body, 500),
                            'url', '/ma-journee', 'badge', v_n);
end;
$$;

revoke all on function public.digest_summary(uuid, date) from public;
revoke all on function public.digest_summary(uuid, date) from anon;
revoke all on function public.digest_summary(uuid, date) from authenticated;
grant execute on function public.digest_summary(uuid, date) to service_role;

-- ---------------------------------------------------------------------------
-- L'envoi (service_role)
-- ---------------------------------------------------------------------------

-- Réclame les résumés dus et les marque envoyés DANS LA MÊME REQUÊTE, avant tout
-- envoi : deux passages du cron qui se chevauchent ne peuvent pas réclamer le
-- même utilisateur (`for update skip locked`), donc jamais deux résumés le même
-- jour. Le prix : un envoi qui échoue après la réclamation n'est pas retenté ce
-- jour-là. Un passage MANQUÉ (déploiement, panne) est, lui, rattrapé au suivant.
--
-- Fenêtre de rattrapage de 6 h (le TTL du push) : sans elle, un utilisateur qui
-- active les notifications à 21 h recevrait son « résumé du matin » à 21 h.
--
-- `last_sent_on` est posé même sans abonnement (§5.2) ; seuls les utilisateurs
-- qui en ont au moins un sont rendus.
create or replace function public.claim_due_digests()
returns table (user_id uuid, summary jsonb, subscriptions jsonb)
language plpgsql volatile security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := private.today();
  v_now   timestamp := (now() at time zone private.app_tz());
begin
  return query
  with due as (
    select s.user_id
    from private.digest_settings s
    join public.profile p on p.id = s.user_id and p.deleted_at is null
    where s.enabled
      and (s.last_sent_on is null or s.last_sent_on < v_today)
      and v_now >= v_today + s.send_time
      and v_now < v_today + s.send_time + interval '6 hours'
    for update of s skip locked
  ), claimed as (
    update private.digest_settings s
    set last_sent_on = v_today
    from due
    where s.user_id = due.user_id
    returning s.user_id
  )
  select c.user_id, public.digest_summary(c.user_id, v_today), private.push_targets(c.user_id)
  from claimed c
  where exists (select 1 from private.push_subscription ps where ps.user_id = c.user_id);
end;
$$;

revoke all on function public.claim_due_digests() from public;
revoke all on function public.claim_due_digests() from anon;
revoke all on function public.claim_due_digests() from authenticated;
grant execute on function public.claim_due_digests() to service_role;

-- Notification de test (§5.3) : le résumé du jour et les abonnements d'un seul
-- utilisateur, sans toucher à `last_sent_on`. L'Edge Function a vérifié le JWT
-- de l'appelant avant de passer son id.
create or replace function public.digest_preview(p_user_id uuid)
returns table (summary jsonb, subscriptions jsonb)
language sql stable security definer
set search_path = ''
as $$
  select public.digest_summary(p_user_id, private.today()), private.push_targets(p_user_id)
$$;

revoke all on function public.digest_preview(uuid) from public;
revoke all on function public.digest_preview(uuid) from anon;
revoke all on function public.digest_preview(uuid) from authenticated;
grant execute on function public.digest_preview(uuid) to service_role;

-- Le bilan d'un passage, en deux appels quel que soit le nombre d'appareils :
-- les abonnements morts (404/410) sont supprimés, les autres datés de leur
-- dernier envoi réussi.
create or replace function public.push_subscriptions_gone(p_ids uuid[])
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from private.push_subscription where id = any (p_ids)
$$;

revoke all on function public.push_subscriptions_gone(uuid[]) from public;
revoke all on function public.push_subscriptions_gone(uuid[]) from anon;
revoke all on function public.push_subscriptions_gone(uuid[]) from authenticated;
grant execute on function public.push_subscriptions_gone(uuid[]) to service_role;

create or replace function public.push_subscriptions_ok(p_ids uuid[])
returns void
language sql volatile security definer
set search_path = ''
as $$
  update private.push_subscription set last_success_at = now() where id = any (p_ids)
$$;

revoke all on function public.push_subscriptions_ok(uuid[]) from public;
revoke all on function public.push_subscriptions_ok(uuid[]) from anon;
revoke all on function public.push_subscriptions_ok(uuid[]) from authenticated;
grant execute on function public.push_subscriptions_ok(uuid[]) to service_role;
