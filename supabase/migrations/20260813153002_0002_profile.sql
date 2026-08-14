-- 0002 — profile : table claire (aucun champ chiffré) → table public + RLS classique.
--
-- SPEC §3 : l'email vit dans auth.users, n'est jamais exposé aux membres d'un espace.
-- Suppression de compte : jamais de DELETE (les FK cascaderaient et détruiraient
-- l'historique des espaces) → soft delete : deleted_at + nom vidé.

create table public.profile (
  id           uuid primary key references auth.users (id),
  display_name text not null default '',
  deleted_at   timestamptz
);

alter table public.profile enable row level security;

-- Grants explicites : ne jamais dépendre des default privileges.
-- Le client ne modifie que display_name ; deleted_at passe par delete_account()
revoke all on table public.profile from anon, authenticated;
grant select on table public.profile to authenticated;
grant update (display_name) on table public.profile to authenticated;

-- Lecture de soi-même. La lecture des co-membres d'espace est ajoutée en 0003.
create policy "profile_select_self"
on public.profile for select to authenticated
using (id = (select auth.uid()));

create policy "profile_update_self"
on public.profile for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (pas d'email copié)
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Suppression de compte : soft delete, les contributions restent anonymisées
-- ---------------------------------------------------------------------------

create or replace function public.delete_account()
returns void
language sql security definer
set search_path = ''
as $$
  update public.profile
  set deleted_at = now(), display_name = ''
  where id = (select auth.uid());
$$;

revoke all on function public.delete_account() from public;
revoke all on function public.delete_account() from anon;
grant execute on function public.delete_account() to authenticated;
