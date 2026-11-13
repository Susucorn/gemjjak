-- save_my_preferences 수정: 직접 입력한 태그를 기존 태그와 맞춰 볼 때
-- 쉼표 조인과 JOIN을 섞어 써서 "invalid reference to FROM-clause entry" 오류가 났다.
-- cross join lateral로 바꾼다. 나머지 내용은 20261112000000_custom_preferences.sql과 같다.

create or replace function public.save_my_preferences(
  p_game_ids bigint[],
  p_custom_games text[],
  p_genre_ids bigint[],
  p_custom_genres text[],
  p_tags text[],
  p_custom_tags jsonb,
  p_hours jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_game_ids bigint[] := coalesce(p_game_ids, '{}');
  v_custom_games text[] := array(
    select distinct btrim(c.name)
    from unnest(coalesce(p_custom_games, '{}')) as c (name)
    where public.normalize_label(c.name) <> ''
  );
  v_genre_ids bigint[] := coalesce(p_genre_ids, '{}');
  v_custom_genres text[] := array(
    select distinct btrim(c.name)
    from unnest(coalesce(p_custom_genres, '{}')) as c (name)
    where public.normalize_label(c.name) <> ''
  );
  v_tags text[] := coalesce(p_tags, '{}');
  v_custom_tags jsonb := coalesce(p_custom_tags, '{}'::jsonb);
  v_hours jsonb := coalesce(p_hours, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  -- 게임 -------------------------------------------------------------------
  if cardinality(v_custom_games) > 10 then
    raise exception 'too many custom games' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_custom_games) as c (name) where char_length(c.name) > 40) then
    raise exception 'custom game name too long' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_game_ids) as g (id)
    where not exists (select 1 from public.games where games.id = g.id)
  ) then
    raise exception 'unknown game id' using errcode = '22023';
  end if;

  v_game_ids := v_game_ids || array(
    select games.id
    from unnest(v_custom_games) as c (name)
    join public.games on exists (
      select 1 from unnest(array[games.name] || games.aliases) as l (label)
      where public.normalize_label(l.label) = public.normalize_label(c.name)
    )
  );
  v_custom_games := array(
    select c.name
    from unnest(v_custom_games) as c (name)
    where not exists (
      select 1
      from public.games, unnest(array[games.name] || games.aliases) as l (label)
      where public.normalize_label(l.label) = public.normalize_label(c.name)
    )
  );
  if cardinality(v_game_ids) + cardinality(v_custom_games) = 0 then
    raise exception 'select at least one game' using errcode = '22023';
  end if;

  -- 장르 -------------------------------------------------------------------
  if cardinality(v_custom_genres) > 5 then
    raise exception 'too many custom genres' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_custom_genres) as c (name) where char_length(c.name) > 20) then
    raise exception 'custom genre name too long' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_genre_ids) as g (id)
    where not exists (select 1 from public.genres where genres.id = g.id)
  ) then
    raise exception 'unknown genre id' using errcode = '22023';
  end if;

  v_genre_ids := v_genre_ids || array(
    select genres.id
    from unnest(v_custom_genres) as c (name)
    join public.genres on public.normalize_label(genres.name) = public.normalize_label(c.name)
  );
  v_custom_genres := array(
    select c.name
    from unnest(v_custom_genres) as c (name)
    where not exists (
      select 1 from public.genres
      where public.normalize_label(genres.name) = public.normalize_label(c.name)
    )
  );
  if cardinality(v_genre_ids) + cardinality(v_custom_genres) = 0 then
    raise exception 'select at least one genre' using errcode = '22023';
  end if;

  -- 태그 -------------------------------------------------------------------
  if exists (
    select 1 from unnest(v_tags) as t (tag)
    where not exists (select 1 from public.tag_vocabulary v where v.tag = t.tag)
  ) then
    raise exception 'unknown tag' using errcode = '22023';
  end if;

  if jsonb_typeof(v_custom_tags) <> 'object' or exists (
    select 1 from jsonb_each(v_custom_tags) as c (category, names)
    where c.category not in ('style', 'activity', 'want') or jsonb_typeof(c.names) <> 'array'
  ) then
    raise exception 'invalid custom tags' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_custom_tags) as c (category, names)
    where jsonb_array_length(c.names) > 5
  ) then
    raise exception 'too many custom tags' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(v_custom_tags) as c (category, names),
      jsonb_array_elements_text(c.names) as n (name)
    where char_length(btrim(n.name)) > 20
  ) then
    raise exception 'custom tag too long' using errcode = '22023';
  end if;

  -- 같은 분류의 기존 태그와 이름만 다르면 그 태그를 고른 것으로 바꾼다.
  v_tags := v_tags || array(
    select v.tag
    from jsonb_each(v_custom_tags) as c (category, names)
    cross join lateral jsonb_array_elements_text(c.names) as n (name)
    join public.tag_vocabulary v
      on v.category = c.category
      and public.normalize_label(v.tag) = public.normalize_label(n.name)
  );

  delete from public.user_custom_tags where user_id = v_user_id;
  insert into public.user_custom_tags (user_id, category, name)
  select v_user_id, c.category, btrim(n.name)
  from jsonb_each(v_custom_tags) as c (category, names),
    jsonb_array_elements_text(c.names) as n (name)
  where public.normalize_label(n.name) <> ''
    and not exists (
      select 1 from public.tag_vocabulary v
      where v.category = c.category
        and public.normalize_label(v.tag) = public.normalize_label(n.name)
    )
  on conflict do nothing;

  if not exists (
    select 1 from unnest(v_tags) as t (tag)
    join public.tag_vocabulary v on v.tag = t.tag and v.category = 'style'
  ) and not exists (
    select 1 from public.user_custom_tags
    where user_id = v_user_id and category = 'style'
  ) then
    raise exception 'select at least one style tag' using errcode = '22023';
  end if;

  -- 접속 시간 ---------------------------------------------------------------
  if jsonb_typeof(v_hours) <> 'object' or exists (
    select 1 from jsonb_each(v_hours) as d (weekday, slots)
    where d.weekday not in ('1', '2', '3', '4', '5', '6', '7') or jsonb_typeof(d.slots) <> 'array'
  ) then
    raise exception 'invalid hours' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(v_hours) as d (weekday, slots),
      jsonb_array_elements(d.slots) as h (hour)
    where jsonb_typeof(h.hour) <> 'number'
      or h.hour::text !~ '^[0-9]{1,2}$'
      or h.hour::text::integer > 23
  ) then
    raise exception 'hour out of range' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_each(v_hours) as d (weekday, slots)
    where jsonb_array_length(d.slots) > 0
  ) then
    raise exception 'select at least one hour' using errcode = '22023';
  end if;

  -- 저장 -------------------------------------------------------------------
  delete from public.user_games where user_id = v_user_id;
  insert into public.user_games (user_id, game_id)
  select distinct v_user_id, g.id from unnest(v_game_ids) as g (id);

  -- "롤 체"와 "롤체"처럼 정규화하면 같은 이름은 하나만 남긴다.
  delete from public.user_custom_games where user_id = v_user_id;
  insert into public.user_custom_games (user_id, name)
  select v_user_id, c.name from unnest(v_custom_games) as c (name)
  on conflict do nothing;

  delete from public.user_genres where user_id = v_user_id;
  insert into public.user_genres (user_id, genre_id)
  select distinct v_user_id, g.id from unnest(v_genre_ids) as g (id);

  delete from public.user_custom_genres where user_id = v_user_id;
  insert into public.user_custom_genres (user_id, name)
  select v_user_id, c.name from unnest(v_custom_genres) as c (name)
  on conflict do nothing;

  delete from public.availability where user_id = v_user_id;
  -- 연속 구간 찾기: 요일마다 정렬된 시각에서 순번을 빼면 연속된 시각끼리 같은 값(grp)이 된다.
  -- 예: 월요일 20, 21, 22 → (월, 20, 23) 한 행
  insert into public.availability (user_id, weekday, start_hour, end_hour)
  select v_user_id, slot.weekday, min(slot.hour), max(slot.hour) + 1
  from (
    select
      s.weekday,
      s.hour,
      s.hour - row_number() over (partition by s.weekday order by s.hour) as grp
    from (
      select distinct d.weekday::smallint as weekday, h.hour::integer as hour
      from jsonb_each(v_hours) as d (weekday, slots),
        jsonb_array_elements_text(d.slots) as h (hour)
    ) as s
  ) as slot
  group by slot.weekday, slot.grp;

  update public.profiles
  set
    tags = (
      select coalesce(array_agg(distinct t.tag order by t.tag), '{}')
      from unnest(v_tags) as t (tag)
    ),
    onboarded = true
  where id = v_user_id;
end;
$$;

revoke execute on function
  public.save_my_preferences(bigint[], text[], bigint[], text[], text[], jsonb, jsonb)
  from public, anon;
grant execute on function
  public.save_my_preferences(bigint[], text[], bigint[], text[], text[], jsonb, jsonb)
  to authenticated;
