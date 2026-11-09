-- 온보딩·프로필 수정에서 게임, 태그, 접속 시간을 한 번에 저장한다.
-- 세 테이블을 따로 저장하면 중간에 실패했을 때 일부만 바뀐 상태가 남으므로 하나의 함수(트랜잭션)로 묶는다.
--
-- 입력
--   p_game_ids       하는 게임 games.id (1개 이상)
--   p_tags           tag_vocabulary에 있는 태그. 'style' 태그가 1개 이상 있어야 한다.
--   p_weekday_hours  평일(월~금) 접속 시각 0~23. 7이면 7시~8시를 뜻한다.
--   p_weekend_hours  주말(토·일) 접속 시각 0~23
--                    평일·주말을 합쳐 1칸 이상이어야 한다.
--
-- 연속된 시각은 하나의 구간으로 합쳐 availability에 요일별로 저장한다.
-- 예: 평일 [20, 21, 22] → 월~금 각각 (20, 23) 한 행
--
-- security invoker라 RLS가 그대로 적용된다. 본인 행만 지우고 쓸 수 있다.
create function public.save_my_preferences(
  p_game_ids bigint[],
  p_tags text[],
  p_weekday_hours integer[],
  p_weekend_hours integer[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_weekday_hours integer[] := coalesce(p_weekday_hours, '{}');
  v_weekend_hours integer[] := coalesce(p_weekend_hours, '{}');
begin
  if v_user_id is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  if coalesce(cardinality(p_game_ids), 0) = 0 then
    raise exception 'select at least one game' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_game_ids) as g (id)
    where not exists (select 1 from public.games where games.id = g.id)
  ) then
    raise exception 'unknown game id' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_tags, '{}')) as t (tag)
    where not exists (select 1 from public.tag_vocabulary v where v.tag = t.tag)
  ) then
    raise exception 'unknown tag' using errcode = '22023';
  end if;
  if not exists (
    select 1 from unnest(coalesce(p_tags, '{}')) as t (tag)
    join public.tag_vocabulary v on v.tag = t.tag and v.category = 'style'
  ) then
    raise exception 'select at least one style tag' using errcode = '22023';
  end if;

  if cardinality(v_weekday_hours) + cardinality(v_weekend_hours) = 0 then
    raise exception 'select at least one hour' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_weekday_hours || v_weekend_hours) as h (hour)
    where h.hour is null or h.hour not between 0 and 23
  ) then
    raise exception 'hour out of range' using errcode = '22023';
  end if;

  delete from public.user_games where user_id = v_user_id;
  insert into public.user_games (user_id, game_id)
  select distinct v_user_id, g.id from unnest(p_game_ids) as g (id);

  delete from public.availability where user_id = v_user_id;
  -- 연속 구간 찾기: 정렬된 시각에서 순번을 빼면 연속된 시각끼리 같은 값(grp)이 된다.
  insert into public.availability (user_id, weekday, start_hour, end_hour)
  select v_user_id, d.weekday, min(slot.hour), max(slot.hour) + 1
  from (
    select s.hour, s.is_weekend, s.hour - row_number() over (partition by s.is_weekend order by s.hour) as grp
    from (
      select distinct h.hour, false as is_weekend from unnest(v_weekday_hours) as h (hour)
      union
      select distinct h.hour, true from unnest(v_weekend_hours) as h (hour)
    ) as s
  ) as slot
  join (
    values (1, false), (2, false), (3, false), (4, false), (5, false), (6, true), (7, true)
  ) as d (weekday, is_weekend) on d.is_weekend = slot.is_weekend
  group by d.weekday, slot.grp;

  update public.profiles
  set
    tags = (select coalesce(array_agg(distinct t.tag order by t.tag), '{}') from unnest(p_tags) as t (tag)),
    onboarded = true
  where id = v_user_id;
end;
$$;

revoke execute on function public.save_my_preferences(bigint[], text[], integer[], integer[])
  from public, anon;
grant execute on function public.save_my_preferences(bigint[], text[], integer[], integer[])
  to authenticated;
