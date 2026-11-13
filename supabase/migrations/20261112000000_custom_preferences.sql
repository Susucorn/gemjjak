-- 목록에 없는 게임·장르·태그(플레이 스타일, 주로 하는 콘텐츠, 찾는 사람)를
-- 사용자가 직접 입력해 바로 쓰게 한다. 게임 추가 요청(관리자 승인)은 없앤다.
-- 접속 시간은 평일/주말 두 가지 대신 요일(월~일)마다 따로 받는다.
--
-- 직접 입력한 값끼리는 정규화한 이름(name_key)이 같으면 같은 것으로 보고 매칭한다.
-- 직접 입력한 값이 기존 목록과 이름만 다르게 쓴 것이면("보이스 ok" → "보이스OK")
-- 새로 저장하지 않고 기존 항목을 고른 것으로 바꾼다.

-- ---------------------------------------------------------------------------
-- 이름 정규화: 대소문자·띄어쓰기·기호를 무시한다. "롤 체" → "롤체", "LoL" → "lol"
-- 클라이언트 src/pages/onboarding/gameSearch.js의 normalize와 같은 규칙이다.
-- ---------------------------------------------------------------------------

create function public.normalize_label(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(coalesce(p_name, ''), '[[:space:]:·_.,!?''"-]', '', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- game_requests → 직접 입력 테이블 3개
-- ---------------------------------------------------------------------------

drop function public.save_my_preferences(bigint[], text[], bigint[], text[], integer[], integer[]);
drop table public.game_requests;

create table public.user_custom_games (
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  name_key text generated always as (public.normalize_label(name)) stored
    check (name_key <> ''),
  created_at timestamptz not null default now(),
  primary key (user_id, name_key)
);

create table public.user_custom_genres (
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  name_key text generated always as (public.normalize_label(name)) stored
    check (name_key <> ''),
  created_at timestamptz not null default now(),
  primary key (user_id, name_key)
);

-- category는 tag_vocabulary.category와 같다.
create table public.user_custom_tags (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('style', 'activity', 'want')),
  name text not null check (char_length(btrim(name)) between 1 and 20),
  name_key text generated always as (public.normalize_label(name)) stored
    check (name_key <> ''),
  created_at timestamptz not null default now(),
  primary key (user_id, category, name_key)
);

create index user_custom_games_name_key_idx on public.user_custom_games (name_key);
create index user_custom_genres_name_key_idx on public.user_custom_genres (name_key);
create index user_custom_tags_name_key_idx on public.user_custom_tags (category, name_key);

alter table public.user_custom_games enable row level security;
alter table public.user_custom_genres enable row level security;
alter table public.user_custom_tags enable row level security;

-- user_games처럼 공개한다. 다른 사용자와 취향이 같은지 비교하는 데 쓴다.
-- 쓰기는 save_my_preferences를 거친다.
create policy "user_custom_games_select" on public.user_custom_games
  for select to authenticated using (true);
create policy "user_custom_games_insert_own" on public.user_custom_games
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_custom_games_delete_own" on public.user_custom_games
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_custom_genres_select" on public.user_custom_genres
  for select to authenticated using (true);
create policy "user_custom_genres_insert_own" on public.user_custom_genres
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_custom_genres_delete_own" on public.user_custom_genres
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "user_custom_tags_select" on public.user_custom_tags
  for select to authenticated using (true);
create policy "user_custom_tags_insert_own" on public.user_custom_tags
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_custom_tags_delete_own" on public.user_custom_tags
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke insert, update on public.user_custom_games from anon, authenticated;
revoke insert, update on public.user_custom_genres from anon, authenticated;
revoke insert, update on public.user_custom_tags from anon, authenticated;
grant insert (user_id, name) on public.user_custom_games to authenticated;
grant insert (user_id, name) on public.user_custom_genres to authenticated;
grant insert (user_id, category, name) on public.user_custom_tags to authenticated;

-- ---------------------------------------------------------------------------
-- save_my_preferences
-- ---------------------------------------------------------------------------

-- 입력
--   p_game_ids       목록에서 고른 게임 games.id
--   p_custom_games   직접 입력한 게임 이름 (최대 10개, 각 40자)
--                    기존 게임 이름이나 별명과 같으면 그 게임으로 바꾼다.
--                    p_game_ids와 합쳐 1개 이상
--   p_genre_ids      목록에서 고른 장르 genres.id
--   p_custom_genres  직접 입력한 장르 이름 (최대 5개, 각 20자). 기존 장르와 같으면 그 장르로 바꾼다.
--                    p_genre_ids와 합쳐 1개 이상
--   p_tags           목록에서 고른 태그. tag_vocabulary에 있어야 한다.
--   p_custom_tags    직접 입력한 태그 {"style": [...], "activity": [...], "want": [...]}
--                    분류마다 최대 5개, 각 20자. 같은 분류의 기존 태그와 같으면 그 태그로 바꾼다.
--                    플레이 스타일(목록 + 직접 입력)이 1개 이상 있어야 한다.
--   p_hours          요일별 접속 시각 {"1": [20, 21], ..., "7": [...]}
--                    키는 ISO 요일 1(월)~7(일), 값은 0~23 시각. 7이면 7시~8시를 뜻한다.
--                    모든 요일을 합쳐 1칸 이상
--
-- 검사에 실패하면 예외가 나고 함수 안에서 바꾼 내용은 모두 되돌려진다.
create function public.save_my_preferences(
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
    from jsonb_each(v_custom_tags) as c (category, names),
      jsonb_array_elements_text(c.names) as n (name)
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
