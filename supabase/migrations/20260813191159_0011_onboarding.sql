-- 0011 — onboarding : mémoriser que la présentation en 4 écrans a été vue.
--
-- Le produit n'a aucune table de préférences, et c'est voulu (SPEC §5 : « aucune
-- préférence à stocker »). Ici il ne s'agit pas d'une préférence d'affichage mais
-- d'un fait de cycle de vie du compte, qui doit suivre l'utilisateur d'un appareil
-- à l'autre — d'où une colonne sur profile plutôt qu'un localStorage.
--
-- profile est une table claire (aucun champ chiffré) : un simple add column suffit,
-- sans le coût d'une migration sur des données chiffrées.

alter table public.profile add column onboarded_at timestamptz;

-- Grants explicites : ne jamais dépendre des default privileges. Les grants de
-- colonne sont additifs — celui posé en 0002 sur display_name reste en place.
grant update (onboarded_at) on table public.profile to authenticated;

-- Aucune policy à ajouter : profile_update_self (0002) couvre déjà l'écriture de
-- sa propre ligne, et le grant de colonne borne ce qui est modifiable.
