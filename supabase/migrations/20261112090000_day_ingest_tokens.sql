-- « Ma journée » (SPEC-MA-JOURNEE §3.1, §4.2) — 1/6 : les jetons d'ingestion.
--
-- Le collecteur Google (Apps Script, un par utilisateur) n'a pas de session : il
-- s'authentifie par un jeton personnel passé en paramètre de
-- `public.ingest_daily_snapshot` (migration day_ingest). Ce jeton n'est JAMAIS
-- stocké en clair : seule son empreinte sha256 (hex) l'est, et
-- `create_ingest_token` le rend une seule fois. Un jeton volé n'ouvre aucune
-- lecture : il ne permet que d'écrire de fausses données dans « Ma journée » de
-- son propriétaire, d'où la révocation depuis les réglages.
--
-- Pas de colonne chiffrée ici, mais la table vit quand même dans `private` : le
-- hash ne doit jamais sortir, et la vue `public.ingest_token` ne l'expose pas.

create table private.ingest_token (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profile (id),
  label        text not null check (char_length(label) between 1 and 100),
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

alter table private.ingest_token enable row level security;

create index ingest_token_user_active_idx on private.ingest_token (user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Lecture : jamais le hash
-- ---------------------------------------------------------------------------

create or replace function public.ingest_token_rows()
returns table (id uuid, label text, created_at timestamptz,
               last_used_at timestamptz, revoked_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select t.id, t.label, t.created_at, t.last_used_at, t.revoked_at
  from private.ingest_token t
  where t.user_id = (select auth.uid())
$$;

revoke all on function public.ingest_token_rows() from public;
revoke all on function public.ingest_token_rows() from anon;
grant execute on function public.ingest_token_rows() to authenticated;

create view public.ingest_token as select * from public.ingest_token_rows();
revoke all on public.ingest_token from anon, authenticated;
grant select on public.ingest_token to authenticated;

-- ---------------------------------------------------------------------------
-- Création : 32 octets aléatoires, base64url, rendus une seule fois
-- ---------------------------------------------------------------------------

create or replace function public.create_ingest_token(p_label text)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_token text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  -- Verrou par utilisateur : sans lui, deux clics simultanés passeraient tous
  -- les deux le compte des jetons actifs et en poseraient un quatrième.
  perform pg_advisory_xact_lock(hashtextextended('ingest_token:' || v_user::text, 0));

  if (select count(*) from private.ingest_token t
      where t.user_id = v_user and t.revoked_at is null) >= 3 then
    raise exception 'ingest_token_cap';
  end if;

  -- base64url sans remplissage : 32 octets → 43 caractères, sans saut de ligne
  -- (encode() n'en insère qu'au-delà de 76).
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into private.ingest_token (user_id, label, token_hash)
  values (v_user, left(coalesce(v_label, 'Collecteur Google'), 100),
          encode(extensions.digest(v_token, 'sha256'), 'hex'));

  return v_token;
end;
$$;

revoke all on function public.create_ingest_token(text) from public;
revoke all on function public.create_ingest_token(text) from anon;
grant execute on function public.create_ingest_token(text) to authenticated;

-- Idempotente : révoquer un jeton déjà révoqué (ou d'un autre) ne fait rien.
create or replace function public.revoke_ingest_token(p_id uuid)
returns void
language sql volatile security definer
set search_path = ''
as $$
  update private.ingest_token
  set revoked_at = now()
  where id = p_id
    and user_id = (select auth.uid())
    and revoked_at is null
$$;

revoke all on function public.revoke_ingest_token(uuid) from public;
revoke all on function public.revoke_ingest_token(uuid) from anon;
grant execute on function public.revoke_ingest_token(uuid) to authenticated;
