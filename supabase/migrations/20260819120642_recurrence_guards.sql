-- Récurrence — les garde-fous qui manquaient.
--
-- Cinq corrections, toutes sur le même chemin (la chaîne de tâches de SPEC §4.3) :
--
--  1. On ne coche plus une occurrence AVANT son échéance. `next_due` s'ancre sur le
--     jour de la coche, jamais sur l'échéance : cocher aujourd'hui une quotidienne
--     due demain engendrait une occurrence… demain, c'est-à-dire un doublon exact de
--     celle qu'on venait de cocher — et chaque clic en refabriquait une. La garde
--     rend l'invariant vrai par construction : `from_day >= due_date` implique
--     `next_due > due_date` sur les trois motifs.
--  2. La forme de la règle est validée EN BASE. Elle ne l'était que côté client, or
--     `weekdays: [0]` faisait tourner sans fin la boucle de `next_due` (la tâche
--     devenait incochable) et un `interval` démesuré faisait déborder `date + int`.
--  3. `next_due` borne sa boucle : ceinture et bretelles de la contrainte ci-dessus,
--     et un motif que la fonction ne sait pas honorer rend `null` au lieu de tourner.
--  4. Décocher défait la génération. Sans lien entre occurrences, décocher laissait
--     la suivante en base, et décoche/recoche en produisait une deuxième. D'où
--     `generated_from` — un lien PRIVÉ, qui n'existe que pour cette annulation : il
--     n'est pas exposé à la vue, il ne survit pas à la suppression du parent, et il
--     ne fait toujours pas de la chaîne un objet « série ».
--  5. `public.skip_task_occurrence()` : passer son tour sans casser la série. C'est
--     ce que choisit l'utilisateur quand il supprime une tâche récurrente et répond
--     « seulement cette fois ». Un déplacement d'échéance, pas un delete + insert :
--     l'id, la position et le titre chiffré restent les mêmes, et l'énumération de
--     colonnes du générateur n'a pas un deuxième endroit où se tromper.
--
-- Contrepartie assumée de (1) : une tâche récurrente faite en avance ne se coche pas
-- le jour où on la fait, il faut d'abord avancer son échéance. Le blocage est visible,
-- là où la duplication était silencieuse.

-- ---------------------------------------------------------------------------
-- 1. Forme de la règle — la seule validation qui existait vivait côté client.
--
-- `case` et non une conjonction : Postgres n'ordonne pas les opérandes d'un `and`,
-- et `jsonb_object_keys` lève sur autre chose qu'un objet. Le `case` garantit que
-- chaque test ne s'exécute qu'une fois les précédents passés.
-- ---------------------------------------------------------------------------

create or replace function private.recurrence_is_valid(rule jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when rule is null then true
    when jsonb_typeof(rule) <> 'object' then false
    -- aucune clé parasite : ce que le serveur ne lit pas n'a rien à faire en base
    when exists (
      select 1 from jsonb_object_keys(rule) k
      where k not in ('type', 'interval', 'weekdays')
    ) then false
    when coalesce(rule ->> 'type', '') not in ('daily', 'weekly', 'monthly') then false
    -- `interval` est obligatoire ; comparé en numeric et jamais casté en int, sans
    -- quoi un 1e30 lèverait au lieu de rendre false
    when jsonb_typeof(rule -> 'interval') is distinct from 'number' then false
    when (rule ->> 'interval')::numeric <> trunc((rule ->> 'interval')::numeric) then false
    when (rule ->> 'interval')::numeric not between 1 and 366 then false
    when rule -> 'weekdays' is null then true
    when rule ->> 'type' <> 'weekly' then false
    when jsonb_typeof(rule -> 'weekdays') <> 'array' then false
    -- tableau vide : le client omet la clé dans ce cas, la garder ferait croire à
    -- une sélection de jours là où il n'y en a pas
    when jsonb_array_length(rule -> 'weekdays') = 0 then false
    when exists (
      select 1 from jsonb_array_elements(rule -> 'weekdays') d
      where jsonb_typeof(d) <> 'number'
         or (d #>> '{}')::numeric not in (1, 2, 3, 4, 5, 6, 7)
    ) then false
    else true
  end
$$;

comment on function private.recurrence_is_valid(jsonb) is
  'Forme de task.recurrence : { type: daily|weekly|monthly, interval: 1..366, weekdays?: [1..7] }.';

-- Une règle invalide était déjà une chaîne morte (`next_due` rendait null) : on
-- l'efface plutôt que de faire échouer le push sur des lignes historiques.
update private.task
set recurrence = null
where recurrence is not null
  and not private.recurrence_is_valid(recurrence);

alter table private.task
  add constraint task_recurrence_shape check (private.recurrence_is_valid(recurrence));

-- ---------------------------------------------------------------------------
-- 2. `next_due` — même sémantique, boucle bornée.
--
-- Seul changement : le `while true` de la retombée hebdomadaire devient borné, et
-- la fonction rend `null` si aucun jour n'est trouvé. Une semaine de plus que la
-- première candidate suffit : un jour listé y tombe forcément, sauf règle absurde.
-- ---------------------------------------------------------------------------

create or replace function private.next_due(rule jsonb, from_day date)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v_type     text := rule ->> 'type';
  v_interval int  := greatest(coalesce((rule ->> 'interval')::int, 1), 1);
  v_weekdays int[];
  v_monday   date;
  v_last     date;
  d          date;
begin
  if v_type = 'daily' then
    return from_day + v_interval;

  elsif v_type = 'weekly' then
    select array_agg(x::int order by x::int) into v_weekdays
    from jsonb_array_elements_text(rule -> 'weekdays') x;
    v_monday := date_trunc('week', from_day::timestamp)::date;

    if v_weekdays is null then
      return from_day + 7 * v_interval;
    end if;

    -- un jour listé reste-t-il dans la semaine en cours, strictement après ?
    d := from_day + 1;
    while d <= v_monday + 6 loop
      if extract(isodow from d)::int = any (v_weekdays) then
        return d;
      end if;
      d := d + 1;
    end loop;

    -- sinon : premier jour listé de la semaine + interval
    d := v_monday + 7 * v_interval;
    v_last := d + 6;
    while d <= v_last loop
      if extract(isodow from d)::int = any (v_weekdays) then
        return d;
      end if;
      d := d + 1;
    end loop;
    return null; -- jours hors 1..7 : la contrainte les interdit, on ne boucle plus

  elsif v_type = 'monthly' then
    -- l'arithmétique Postgres borne déjà fin de mois (31 janv + 1 mois = 28/29 févr) ;
    -- l'ancrage au 31 est perdu après un mois court : assumé par la SPEC §4.3
    return (from_day + make_interval(months => v_interval))::date;
  end if;

  return null; -- motif inconnu : la chaîne s'arrête silencieusement
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Le lien privé d'une occurrence vers celle qui l'a engendrée.
--
-- `on delete set null`, jamais `cascade` : supprimer une occurrence cochée ne doit
-- pas emporter la suivante, qui vit déjà sa vie. La colonne n'entre pas dans
-- `public.task_rows()` : le client ne la voit pas et n'a rien à en faire.
-- ---------------------------------------------------------------------------

alter table private.task
  add column generated_from uuid references private.task (id) on delete set null;

create index task_generated_from_idx on private.task (generated_from)
  where generated_from is not null;

comment on column private.task.generated_from is
  'Occurrence dont la complétion a engendré cette ligne. Sert uniquement à défaire cette complétion au décochage.';

-- ---------------------------------------------------------------------------
-- 4. Le trigger de complétion : génération + annulation au décochage.
-- Reprise de la version courante (migration objective_period_regularity), avec
-- trois changements marqués ci-dessous.
-- ---------------------------------------------------------------------------

create or replace function private.on_task_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old_day date;
  v_new_day date;
  v_done_day date;
  v_next date;
  v_objective uuid;
  v_assignee uuid;
begin
  -- 1. Relevé : rafraîchir chaque (objectif, période) touché
  if tg_op in ('UPDATE', 'DELETE')
     and old.completed_at is not null and old.objective_id is not null then
    v_old_day := private.credit_day(old.due_date, old.completed_at);
    perform private.refresh_objective_period(old.objective_id, v_old_day);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
     and new.completed_at is not null and new.objective_id is not null then
    v_new_day := private.credit_day(new.due_date, new.completed_at);
    if tg_op = 'INSERT'
       or old.completed_at is distinct from new.completed_at
       or old.due_date is distinct from new.due_date
       or old.objective_id is distinct from new.objective_id
       or v_old_day is distinct from v_new_day then
      perform private.refresh_objective_period(new.objective_id, v_new_day);
    end if;
  end if;

  -- 2. Récurrence : à la complétion uniquement (transition null → non null)
  if tg_op = 'UPDATE'
     and old.completed_at is null
     and new.completed_at is not null
     and new.recurrence is not null then
    v_done_day := private.app_day(new.completed_at);
    v_next := private.next_due(new.recurrence, v_done_day);
    if v_next is not null then
      -- objectif archivé → l'occurrence suivante naît détachée (SPEC §4.3)
      v_objective := new.objective_id;
      if v_objective is not null then
        select case when private.is_archived(o.year) then null else o.id end
        into v_objective
        from private.objective o where o.id = v_objective;
      end if;
      -- un assigné qui a quitté l'espace ne se recopie pas d'occurrence en
      -- occurrence : la vue le refuserait, l'insert système la contourne
      v_assignee := new.assignee_id;
      if v_assignee is not null and not exists (
        select 1 from public.space_member m
        where m.space_id = new.space_id and m.user_id = v_assignee and m.left_at is null
      ) then
        v_assignee := null;
      end if;
      -- bytea recopiés tels quels : aucun re-chiffrement ; validation de
      -- rattachement court-circuitée (le cocheur n'est pas forcément
      -- le propriétaire du fork)
      perform set_config('clarity.system_write', 'on', true);
      insert into private.task
        (user_id, space_id, assignee_id, list_id, objective_id,
         title_enc, description_enc, due_date, is_important, "position", recurrence,
         generated_from)
      values
        (new.user_id, new.space_id, v_assignee, new.list_id, v_objective,
         new.title_enc, new.description_enc, v_next, new.is_important,
         new."position", new.recurrence, new.id);
      perform set_config('clarity.system_write', '', true);
    end if;
  end if;

  -- 3. Décochage : défaire la génération (transition non null → null).
  -- `completed_at is null` est le cœur de la règle : si l'occurrence engendrée a
  -- déjà été cochée, elle porte du crédit et a peut-être engendré la sienne — on
  -- n'y touche pas. Pas de récursion : ce DELETE rejoue le trigger sur une ligne
  -- non cochée, où aucun bloc ne s'applique.
  if tg_op = 'UPDATE'
     and old.completed_at is not null
     and new.completed_at is null then
    delete from private.task
    where generated_from = old.id and completed_at is null;
  end if;

  return null; -- AFTER trigger
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. La vue des tâches : on ne coche pas une récurrente avant son échéance.
-- Reprise de la version courante (migration completed_at_server), avec la seule
-- garde ajoutée dans la branche UPDATE.
-- ---------------------------------------------------------------------------

create or replace function private.task_view_iiud()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Le WHERE de la vue ne s'applique pas à l'INSERT : revalider le prédicat
    if not (new.user_id = (select auth.uid())
            or (new.space_id is not null and public.is_space_member(new.space_id))) then
      raise exception 'task_write_not_allowed';
    end if;
    if new.assignee_id is not null and not exists (
      select 1 from public.space_member m
      where m.space_id = new.space_id and m.user_id = new.assignee_id and m.left_at is null
    ) then
      raise exception 'task_assignee_not_member';
    end if;
    -- completed_at / completed_by : imposés par le serveur (assignés à NEW pour
    -- que le RETURNING vu par le client reflète la réalité)
    new.completed_at := case when new.completed_at is null then null
                             else now() end;
    new.completed_by := case when new.completed_at is null then null
                             else (select auth.uid()) end;
    insert into private.task
      (user_id, space_id, assignee_id, list_id, objective_id,
       title_enc, description_enc, due_date, is_important, "position", recurrence,
       completed_at, completed_by)
    values
      (new.user_id, new.space_id, new.assignee_id, new.list_id, new.objective_id,
       private.enc(new.title), private.enc(new.description), new.due_date,
       coalesce(new.is_important, false), coalesce(new."position", 0), new.recurrence,
       new.completed_at, new.completed_by)
    returning id, created_at into new.id, new.created_at;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.space_id is distinct from old.space_id then
      raise exception 'task_owner_immutable';
    end if;
    if new.assignee_id is not null
       and new.assignee_id is distinct from old.assignee_id
       and not exists (
         select 1 from public.space_member m
         where m.space_id = new.space_id and m.user_id = new.assignee_id and m.left_at is null
       ) then
      raise exception 'task_assignee_not_member';
    end if;
    -- Une occurrence récurrente ne se coche pas avant son échéance : la suivante
    -- se calcule depuis le jour de la coche, elle retomberait sur la date qu'on
    -- vient de cocher et la série piétinerait au lieu d'avancer. La garde ne porte
    -- que sur la complétion — décocher, renommer ou déplacer restent libres — et
    -- épargne les tâches sans échéance (qui s'ancrent sur aujourd'hui) comme les
    -- non récurrentes (faire quelque chose en avance est normal).
    if new.completed_at is not null and old.completed_at is null
       and new.recurrence is not null
       and new.due_date is not null and new.due_date > private.today() then
      raise exception 'task_recurrence_future';
    end if;
    -- completed_at / completed_by : imposés par le serveur, jamais confiés au
    -- client. Le client ne décide que du null / non-null.
    new.completed_at := case
                          when new.completed_at is null then null
                          when old.completed_at is null then now()
                          else old.completed_at   -- re-cocher ne redate pas
                        end;
    new.completed_by := case
                          when new.completed_at is null then null
                          when old.completed_at is null then (select auth.uid())
                          else old.completed_by
                        end;
    update private.task
    set assignee_id     = new.assignee_id,
        list_id         = new.list_id,
        objective_id    = new.objective_id,
        title_enc       = private.enc(new.title),
        description_enc = private.enc(new.description),
        due_date        = new.due_date,
        is_important    = new.is_important,
        "position"      = new."position",
        recurrence      = new.recurrence,
        completed_at    = new.completed_at,
        completed_by    = new.completed_by
    where id = old.id; -- old vient de la vue → déjà filtré
    return new;
  else
    delete from private.task where id = old.id; -- suppression définitive (pas de corbeille)
    return old;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Passer son tour.
--
-- L'ancre est l'échéance sautée, pas le jour courant : la série garde sa grille
-- (un lundi sauté revient au lundi suivant). Une échéance déjà passée repart
-- d'aujourd'hui, sinon on engendrerait une occurrence née en retard.
--
-- `security definer` + `set search_path = ''` + objets qualifiés : le WHERE de la
-- fonction EST la sécurité — ici le prédicat de visibilité de la vue, recopié.
-- ---------------------------------------------------------------------------

create or replace function public.skip_task_occurrence(p_task uuid)
returns date
language plpgsql security definer
set search_path = ''
as $$
declare
  t private.task;
  v_anchor date;
  v_next date;
begin
  select * into t from private.task where id = p_task;
  if not found
     or not (t.user_id = (select auth.uid())
             or (t.space_id is not null and public.is_space_member(t.space_id))) then
    raise exception 'task_write_not_allowed';
  end if;
  if t.completed_at is not null then
    raise exception 'task_already_completed';
  end if;
  if t.recurrence is null then
    raise exception 'task_not_recurring';
  end if;

  v_anchor := greatest(coalesce(t.due_date, private.today()), private.today());
  v_next := private.next_due(t.recurrence, v_anchor);
  if v_next is null then
    raise exception 'task_recurrence_unknown';
  end if;

  update private.task set due_date = v_next where id = p_task;
  return v_next;
end;
$$;

revoke all on function public.skip_task_occurrence(uuid) from public;
revoke all on function public.skip_task_occurrence(uuid) from anon;
grant execute on function public.skip_task_occurrence(uuid) to authenticated;

comment on function public.skip_task_occurrence(uuid) is
  'Passe le tour d''une tâche récurrente : déplace son échéance à la suivante et rend cette date. La série continue.';
