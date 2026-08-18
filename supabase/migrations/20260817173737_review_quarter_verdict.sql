-- 0021 — le verdict `achieved` descend du bilan annuel au bilan trimestriel.
--
-- REFONTE §8. Deux choses donnent au bilan de trimestre un rôle que rien d'autre
-- ne peut tenir : un objectif trimestriel s'y **termine**, et un slot s'y libère.
-- Or 0009 réservait `achieved` au seul niveau `year` — un objectif de T3 n'avait
-- donc aucune façon de recevoir sa conclusion à la fin de T3, seulement une note
-- de plus.
--
-- La règle par niveau devient :
--
--   week      rating seul
--   quarter   rating OU achieved, jamais les deux
--   year      achieved seul
--
-- Un objectif ANNUEL passe au bilan de T3 sans s'y terminer : il reçoit une note.
-- Un objectif TRIMESTRIEL de T3 s'y ferme : il reçoit un verdict. Les deux formes
-- coexistent donc dans la même session, d'où l'exclusivité par LIGNE et non par
-- niveau — et d'où l'impossibilité de porter la règle par un `check` de table :
-- `period_type` vit dans `public.review`, pas dans `private.review_item`.
--
-- La procédure §0.2 (drop view / drop function / recréation) NE S'APPLIQUE PAS :
-- `rating` et `achieved` existent déjà dans `private.review_item`, dans
-- `public.review_item_rows()` et dans la vue. Aucune signature ne change, donc un
-- `create or replace` du seul corps suffit et le trigger `review_item_iiud`
-- (0009) reste attaché.
--
-- La version recopiée ci-dessous est celle de `20260813153013_0009_review.sql` —
-- `private.review_item_view_iiud()` n'a jamais été réécrite depuis (§0.3). Seul
-- le bloc « saisie selon le niveau » change ; tout le reste est à l'identique.

create or replace function private.review_item_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.review;
  o private.objective;
begin
  if tg_op = 'DELETE' then
    -- ne supprimer que ce qu'on aurait le droit d'écrire
    select * into r from public.review where id = old.review_id;
    if not (r.user_id = (select auth.uid())
            or (r.space_id is not null
                and exists (select 1 from private.objective f
                            where f.id = old.objective_id
                              and f.user_id = (select auth.uid())))) then
      raise exception 'review_item_delete_not_allowed';
    end if;
    delete from private.review_item where id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.review_id is distinct from old.review_id
          or new.objective_id is distinct from old.objective_id) then
    raise exception 'review_item_identity_immutable';
  end if;

  select * into r from public.review where id = new.review_id;
  if not found then
    raise exception 'review_item_review_not_found';
  end if;
  select * into o from private.objective where id = new.objective_id;
  if not found then
    raise exception 'review_item_objective_not_found';
  end if;

  -- Portée (SPEC §4.4) : review perso → mes objectifs non forkés ;
  -- review d'espace → uniquement MES forks d'un principal de CET espace.
  if r.user_id is not null then
    if r.user_id <> (select auth.uid())
       or o.user_id is distinct from (select auth.uid())
       or o.parent_objective_id is not null then
      raise exception 'review_item_scope_personal';
    end if;
  else
    if not public.is_space_member(r.space_id) then
      raise exception 'review_item_not_member';
    end if;
    if o.parent_objective_id is null or o.user_id is distinct from (select auth.uid()) then
      raise exception 'review_item_scope_space: on ne note que ses propres forks';
    end if;
    if (select p.space_id from private.objective p where p.id = o.parent_objective_id)
       is distinct from r.space_id then
      raise exception 'review_item_fork_space_mismatch';
    end if;
  end if;

  -- Saisie selon le niveau : la semaine se note, l'année se conclut, le trimestre
  -- fait les deux — mais jamais sur la même ligne. Un objectif se note OU reçoit
  -- un verdict, selon que sa fenêtre se poursuit ou se ferme avec ce trimestre.
  --
  -- Attention à l'UPDATE : sur un trigger INSTEAD OF, `new` porte les valeurs
  -- ANCIENNES des colonnes absentes du SET. Poser un `achieved` sur une ligne qui
  -- porte déjà un `rating` lève donc l'exclusivité même si le client n'a envoyé
  -- qu'un champ — c'est voulu, et le front efface l'autre dans le même patch.
  if r.period_type = 'week' then
    if new.achieved is not null then
      raise exception 'review_item_achieved_year_only';
    end if;
  elsif r.period_type = 'quarter' then
    if new.rating is not null and new.achieved is not null then
      raise exception 'review_item_verdict_exclusive';
    end if;
  else
    if new.rating is not null then
      raise exception 'review_item_rating_not_for_year';
    end if;
  end if;

  if new.comment is not null and char_length(new.comment) > 280 then
    raise exception 'review_item_comment_too_long: 280 caractères max';
  end if;

  if tg_op = 'INSERT' then
    insert into private.review_item (review_id, objective_id, rating, achieved, comment_enc)
    values (new.review_id, new.objective_id, new.rating, new.achieved, private.enc(new.comment))
    returning id, created_at, updated_at into new.id, new.created_at, new.updated_at;
  else
    update private.review_item
    set rating      = new.rating,
        achieved    = new.achieved,
        comment_enc = private.enc(new.comment),
        updated_at  = now()
    where id = old.id;
  end if;
  return new;
end;
$$;
