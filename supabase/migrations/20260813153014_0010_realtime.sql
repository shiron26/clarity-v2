-- 0010 — Realtime pour les sessions de review d'espace (SPEC §4.4).
--
-- Deux canaux :
--   1. postgres_changes sur public.review (table claire, RLS) : curseur partagé
--      current_objective_id + validated_at. Seul vrai besoin temps réel du produit.
--   2. Broadcast-from-Database pour review_item (table chiffrée, non publiable) :
--      le trigger émet un signal {table, id} — le client INVALIDE sa query,
--      il ne lit JAMAIS le payload (qui ne contient d'ailleurs aucune donnée).

alter publication supabase_realtime add table public.review;
alter table public.review replica identity full;

-- ---------------------------------------------------------------------------
-- Signal d'invalidation sur les notes/commentaires pendant une session
-- ---------------------------------------------------------------------------

create or replace function private.broadcast_review_item_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_space uuid;
begin
  select r.space_id into v_space
  from public.review r
  where r.id = coalesce(new.review_id, old.review_id);

  if v_space is not null then
    perform realtime.send(
      jsonb_build_object('table', 'review_item', 'id', coalesce(new.id, old.id)),
      'invalidate',
      'space:' || v_space::text,
      true -- canal privé : autorisation par la policy sur realtime.messages
    );
  end if;
  return null;
end;
$$;

create trigger review_item_broadcast
after insert or update or delete on private.review_item
for each row execute function private.broadcast_review_item_change();

-- Réception des broadcasts 'space:<uuid>' réservée aux membres actifs de l'espace
create policy "space_members_receive_broadcasts"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() like 'space:%'
  and substring(realtime.topic() from 7)
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_space_member(substring(realtime.topic() from 7)::uuid)
);
