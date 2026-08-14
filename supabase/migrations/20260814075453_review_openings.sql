-- review_openings — les instants d'ouverture des rituels de review, et
-- l'estampille serveur de la validation d'une session.
--
-- Deux règles de la SPEC §4.4 qui n'avaient pas encore de porteur en base.

-- ---------------------------------------------------------------------------
-- 1. Quand un rituel de review s'ouvre.
--
-- SPEC §4.4 : la review hebdo ouvre le vendredi 18h, le bilan trimestriel le
-- dernier vendredi du trimestre à 18h, le bilan annuel le dernier vendredi de
-- décembre à 18h.
--
-- Pourquoi le serveur et pas le client : « 18h » est une heure murale dans le
-- fuseau de l'application, qui vit dans private.app_config et n'est pas lisible
-- par le rôle API (même raison que public.app_day_start()). Et surtout, la
-- comparaison à « maintenant » doit se faire contre l'horloge du serveur : un
-- navigateur en avance de deux minutes déverrouillerait la review avant l'heure.
--
-- La fonction rend des années entières d'un coup — 53 semaines + 4 trimestres +
-- le bilan annuel par année demandée. Le hub interroge l'ouverture de chacune
-- des treize cartes de sa grille ; un appel par carte serait absurde.
--
-- L'argument est un tableau parce qu'une grille de trimestre peut enjamber deux
-- années ISO : la semaine qui contient le 1er janvier appartient parfois encore
-- à l'année ISO précédente. `period_year` est donc rendu, et c'est le couple
-- (type, année, index) qui identifie une période — jamais l'index seul.
--
-- Attention à la double nature des années ici, assumée : les semaines sont
-- numérotées en année ISO, les trimestres et le bilan annuel en année civile.
-- C'est exactement la convention de `review.period_year`.
--
-- Repères de calendrier utilisés :
--   · le 4 janvier est toujours dans la semaine ISO 1, le 28 décembre toujours
--     dans la dernière — d'où les deux bornes du generate_series ;
--   · date_trunc('week', …) rend le lundi, +4 jours donne le vendredi ;
--   · dernier vendredi d'un mois = dernier jour du mois reculé de
--     ((isodow + 2) % 7) jours (0 si c'est déjà un vendredi).
-- ---------------------------------------------------------------------------

create or replace function public.review_openings(p_years int[])
returns table (
  period_type text, period_year int, period_index int,
  open_at timestamptz, is_open boolean
)
language sql stable security definer
set search_path = ''
as $$
  -- Colonnes volontairement nommées autrement que les OUT params de RETURNS
  -- TABLE : ceux-ci sont visibles dans le corps et rendraient les références
  -- ambiguës.
  with years as (
    select distinct y from unnest(p_years) as y
  ),
  anchors as (
    select 'week'::text as ptype,
           y.y as pyear,
           extract(week from d)::int as pindex,
           d::date as friday
    from years y
    cross join lateral generate_series(
           date_trunc('week', make_date(y.y, 1, 4)::timestamp)::date + 4,
           date_trunc('week', make_date(y.y, 12, 28)::timestamp)::date + 4,
           interval '7 days'
         ) as d

    union all

    select 'quarter'::text,
           y.y,
           q::int,
           last_day - ((extract(isodow from last_day)::int + 2) % 7)
    from years y
    cross join generate_series(1, 4) as q
    cross join lateral (
      select (make_date(y.y, 3 * q, 1) + interval '1 month' - interval '1 day')::date
    ) as m (last_day)

    union all

    select 'year'::text,
           y.y,
           null::int,
           last_day - ((extract(isodow from last_day)::int + 2) % 7)
    from years y
    cross join lateral (select make_date(y.y, 12, 31)) as m (last_day)
  ),
  opened as (
    select a.ptype,
           a.pyear,
           a.pindex,
           (a.friday + interval '18 hours') at time zone private.app_tz() as at
    from anchors a
  )
  select o.ptype, o.pyear, o.pindex, o.at, now() >= o.at
  from opened o
  order by o.ptype, o.pyear, o.pindex
$$;

revoke all on function public.review_openings(int[]) from public;
revoke all on function public.review_openings(int[]) from anon;
grant execute on function public.review_openings(int[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le compteur qui ouvre le flow de review : « N tâches accomplies cette
--    semaine, dont M liées à tes objectifs ».
--
-- Deux règles serveur en jeu, aucune des deux réimplémentable côté client :
--   · « quel jour compte une tâche cochée » — c'est private.credit_day, la même
--     formule que les jours actifs et que objective_week. La réécrire en TS ferait
--     dire à l'écran 1 du flow autre chose qu'à l'écran 2, qui montre les mêmes
--     journées en cases ;
--   · la borne de journée dépend du fuseau de l'application, invisible du rôle API
--     (même raison que public.app_day_start()). Comparer completed_at à un
--     « lundi minuit » fabriqué par le navigateur décalerait d'une à deux heures.
--
-- Portée perso : la review hebdo perso porte sur les objectifs perso (SPEC §4.4),
-- le compteur qui l'ouvre suit le même périmètre.
-- ---------------------------------------------------------------------------

create or replace function public.week_task_count(p_from date, p_to date)
returns table (total int, linked int)
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int,
         count(*) filter (where t.objective_id is not null)::int
  from private.task t
  where t.user_id = (select auth.uid())
    and t.completed_at is not null
    and private.credit_day(t.due_date, t.completed_at) between p_from and p_to
$$;

revoke all on function public.week_task_count(date, date) from public;
revoke all on function public.week_task_count(date, date) from anon;
grant execute on function public.week_task_count(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. validated_at est une estampille serveur, pas une date envoyée par le client.
--
-- 0009 imposait déjà validated_by ; validated_at restait à la main du client,
-- donc à l'horloge du navigateur. Même traitement que completed_at et closed_at
-- (migrations completed_at_server / closed_at_server) : la valeur envoyée n'est
-- lue que comme un signal booléen (null / non-null), l'instant vient de now().
-- Assigné à NEW pour que le RETURNING reflète la réalité.
--
-- Le reste de la fonction est identique à 0009.
-- ---------------------------------------------------------------------------

create or replace function private.validate_review_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.space_id is distinct from old.space_id
     or new.period_type is distinct from old.period_type
     or new.period_year is distinct from old.period_year
     or new.period_index is distinct from old.period_index
     or new.created_by is distinct from old.created_by then
    raise exception 'review_identity_immutable';
  end if;
  if new.validated_at is distinct from old.validated_at then
    if old.created_by <> (select auth.uid()) then
      raise exception 'review_validate_creator_only';
    end if;
    new.validated_at := case when new.validated_at is null then null else now() end;
    new.validated_by := case when new.validated_at is null then null
                             else (select auth.uid()) end;
  end if;
  -- le curseur partagé ne pointe que vers un objectif visible de l'appelant
  if new.current_objective_id is not null
     and new.current_objective_id is distinct from old.current_objective_id
     and not public.is_objective_visible(new.current_objective_id) then
    raise exception 'review_cursor_not_visible';
  end if;
  return new;
end;
$$;
