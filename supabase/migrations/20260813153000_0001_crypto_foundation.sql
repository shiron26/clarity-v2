-- 0001 — Socle : schéma private, extensions, Vault, chiffrement, configuration.
--
-- Architecture (SPEC §2) :
--   private  : tables à colonnes chiffrées (_enc) + fonctions sensibles. Jamais exposé
--              à PostgREST, aucun droit pour anon/authenticated (pas même USAGE).
--   public   : vues déchiffrantes SECURITY DEFINER (le WHERE de la vue EST la sécurité),
--              tables sans champ chiffré (RLS classique), RPC.
--
-- Prérequis manuel (une fois, jamais en migration) : poser la clé dans le Vault
--   select vault.create_secret('<openssl rand -base64 32>', 'clarity_app_key', '...');

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Schéma private : invisible et inaccessible aux rôles API
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- ---------------------------------------------------------------------------
-- Configuration applicative — le fuseau ne doit apparaître en dur nulle part
-- ---------------------------------------------------------------------------

create table private.app_config (
  key   text primary key,
  value text not null
);

alter table private.app_config enable row level security;

insert into private.app_config (key, value) values ('timezone', 'Europe/Paris');

create or replace function private.app_tz()
returns text
language sql stable
set search_path = ''
as $$
  select value from private.app_config where key = 'timezone'
$$;

create or replace function private.today()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone private.app_tz())::date
$$;

-- Jour "vécu" d'un timestamptz, dans le fuseau de l'application
create or replace function private.app_day(p timestamptz)
returns date
language sql stable
set search_path = ''
as $$
  select (p at time zone private.app_tz())::date
$$;

-- ---------------------------------------------------------------------------
-- Clé applicative (Vault) et chiffrement
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER : seul le propriétaire (postgres) lit le Vault.
-- Jamais exécutable par les rôles API : un utilisateur récupérerait la clé.
-- Échoue BRUYAMMENT si la clé manque : pgp_sym_encrypt est STRICT, une clé
-- null produirait des chiffrés null silencieux au lieu d'une erreur.
create or replace function private.app_key()
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  k text;
begin
  select decrypted_secret into k
  from vault.decrypted_secrets
  where name = 'clarity_app_key';
  if k is null then
    raise exception 'clarity_app_key absente du Vault — voir README (mise en place du backend)';
  end if;
  return k;
end;
$$;

revoke all on function private.app_key() from public;
revoke all on function private.app_key() from anon;
revoke all on function private.app_key() from authenticated;

-- Helpers de (dé)chiffrement — dans private : inaccessibles aux rôles API
-- par construction, seuls les vues/triggers/fonctions definer les appellent.
create or replace function private.enc(p text)
returns bytea
language sql stable
set search_path = ''
as $$
  select case
    when p is null then null
    else extensions.pgp_sym_encrypt(p, private.app_key())
  end
$$;

create or replace function private.dec(p bytea)
returns text
language sql stable
set search_path = ''
as $$
  select case
    when p is null then null
    else extensions.pgp_sym_decrypt(p, private.app_key())
  end
$$;
