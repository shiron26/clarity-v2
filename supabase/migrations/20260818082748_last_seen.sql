-- 0022 — `profile.last_seen_on` : le dernier jour applicatif d'ouverture.
--
-- REFONTE §9. Le pain point d'origine du produit est que l'absence produit une
-- dette : ne pas ouvrir ne coûte rien sur le moment, mais fabrique un trou qui se
-- lit comme un échec. Le rituel (§7) l'a déplacée du jour à la semaine ; reste le
-- cas qu'aucun rituel ne rattrape — plusieurs semaines sautées d'affilée. Pour y
-- répondre par un accueil plutôt que par un reproche, il faut connaître l'écart,
-- donc mémoriser la dernière visite.
--
-- Gabarit : `onboarded_at` (0011), à un écart près qui est tout l'objet du §9.
-- `onboarded_at` a reçu un `grant update` et s'écrit depuis le client. Pas
-- `last_seen_on` : c'est une date applicative qui borne un écart, et l'horloge du
-- navigateur n'a pas voix au chapitre — même doctrine que `completed_at`,
-- `closed_at` et `objective_entry.entry_date`. Sans grant de colonne, l'écriture
-- directe part en 42501, exactement comme pour `deleted_at` (0002). Il n'y a aucun
-- trigger de gel sur `public.profile` : le grant de colonne EST le mécanisme.
--
-- `profile` est une table claire (aucun champ chiffré) : un simple add column
-- suffit, la procédure §0.2 des vues déchiffrantes ne s'applique pas.

-- Lisible des co-membres d'espace : le `grant select` de 0002 porte sur la table,
-- et la policy `profile_select_space_comembers` (0003) expose la ligne. Assumé —
-- une date d'ouverture est une donnée faible, et les espaces sont hors périmètre
-- de la refonte. Si le modèle de menace évolue, il faudra passer ce `grant select`
-- en liste de colonnes, ce qui interdirait le `select *` sur `profile`.
alter table public.profile add column last_seen_on date;

-- Volontairement PAS de `grant update (last_seen_on)` : la colonne ne s'écrit que
-- par la RPC ci-dessous.

-- ---------------------------------------------------------------------------
-- La visite : apprendre l'écart et l'enregistrer dans le même aller-retour.
-- ---------------------------------------------------------------------------
--
-- Une RPC plutôt qu'un select suivi d'un update : entre les deux, un second
-- onglet aurait le temps de lire la même ancienne valeur et de rejouer l'accueil.
-- Le corollaire structure le front — l'écart n'est lisible qu'UNE fois, donc
-- l'écran qui s'en sert doit le figer plutôt que le relire.

create or replace function public.touch_last_seen()
returns date
language plpgsql security definer
set search_path = ''
as $$
declare
  v_previous date;
begin
  -- `for update` sérialise deux chargements concurrents : le second attend, lit
  -- la date que le premier vient de poser, et rend donc un écart nul au lieu de
  -- rouvrir la cérémonie dans un deuxième onglet.
  select p.last_seen_on into v_previous
  from public.profile p
  where p.id = (select auth.uid())
  for update;

  update public.profile
  set last_seen_on = private.today()
  where id = (select auth.uid());

  -- `null` à la toute première visite : une donnée absente n'est pas une absence,
  -- et le front s'en tait. C'est aussi ce qui évite que tous les comptes existants
  -- voient « Bon retour » le jour du déploiement.
  return v_previous;
end;
$$;

revoke all on function public.touch_last_seen() from public;
revoke all on function public.touch_last_seen() from anon;
grant execute on function public.touch_last_seen() to authenticated;
