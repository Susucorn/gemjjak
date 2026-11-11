-- 프로필 화면: 닉네임·소개·서버 정보 길이 제한, 게임 요청 취소, 구글 가입 프로필

-- ---------------------------------------------------------------------------
-- 길이 제한
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint profiles_nickname_length check (char_length(btrim(nickname)) between 1 and 20),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 150);

alter table public.servers
  add constraint servers_name_length check (char_length(btrim(name)) between 1 and 40),
  add constraint servers_description_length
    check (description is null or char_length(description) <= 300);

-- 디스코드 가입은 디스코드 이름과 프로필 사진을 쓴다.
--   디스코드 이름은 32자까지라 그대로 넣으면 위 제약에 걸려 가입이 실패한다. 20자로 자른다.
-- 구글 가입은 이름이 대부분 실명이고 사진도 얼굴인 경우가 많아 가져오지 않는다.
--   '게이머' + id 앞 6자리로 시작하고 프로필에서 바꾼다.
-- 이메일 앞부분도 공개 프로필에 노출되므로 닉네임 기본값으로 쓰지 않는다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  is_discord boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'discord';
  default_nickname text := '게이머' || left(new.id::text, 6);
begin
  if not is_discord then
    insert into public.profiles (id, nickname) values (new.id, default_nickname);
    return new;
  end if;

  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    btrim(left(coalesce(
      nullif(btrim(meta #>> '{custom_claims,global_name}'), ''),
      nullif(btrim(meta ->> 'full_name'), ''),
      nullif(btrim(meta ->> 'name'), ''),
      default_nickname
    ), 20)),
    nullif(btrim(meta ->> 'avatar_url'), '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 게임 요청 취소: 아직 확인 전(pending)인 본인 요청만 지울 수 있다.
-- ---------------------------------------------------------------------------

create policy "game_requests_delete_own_pending" on public.game_requests
  for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'pending');

-- ---------------------------------------------------------------------------
-- save_my_preferences: 이번에 보내지 않은 pending 요청은 지운다.
-- 프로필에서 요청 칩을 빼면 요청도 취소되게 하기 위해서다.
-- ---------------------------------------------------------------------------

create or replace function public.save_my_preferences(
  p_game_ids bigint[],
  p_requested_games text[],
  p_genre_ids bigint[],
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
  v_game_ids bigint[] := coalesce(p_game_ids, '{}');
  v_requested text[] := array(
    select distinct btrim(r.name)
    from unnest(coalesce(p_requested_games, '{}')) as r (name)
    where btrim(r.name) <> ''
  );
  v_genre_ids bigint[] := coalesce(p_genre_ids, '{}');
  v_weekday_hours integer[] := coalesce(p_weekday_hours, '{}');
  v_weekend_hours integer[] := coalesce(p_weekend_hours, '{}');
begin
  if v_user_id is null then
    raise exception 'login required' using errcode = '42501';
  end if;

  if cardinality(v_game_ids) + cardinality(v_requested) = 0 then
    raise exception 'select or request at least one game' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_game_ids) as g (id)
    where not exists (select 1 from public.games where games.id = g.id)
  ) then
    raise exception 'unknown game id' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_requested) as r (name) where char_length(r.name) > 40) then
    raise exception 'requested game name too long' using errcode = '22023';
  end if;

  if cardinality(v_genre_ids) = 0 then
    raise exception 'select at least one genre' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_genre_ids) as g (id)
    where not exists (select 1 from public.genres where genres.id = g.id)
  ) then
    raise exception 'unknown genre id' using errcode = '22023';
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
  select distinct v_user_id, g.id from unnest(v_game_ids) as g (id);

  delete from public.user_genres where user_id = v_user_id;
  insert into public.user_genres (user_id, genre_id)
  select distinct v_user_id, g.id from unnest(v_genre_ids) as g (id);

  delete from public.game_requests r
  where r.user_id = v_user_id
    and r.status = 'pending'
    and lower(regexp_replace(r.name, '\s', '', 'g')) <> all (
      select lower(regexp_replace(q.name, '\s', '', 'g')) from unnest(v_requested) as q (name)
    );

  insert into public.game_requests (user_id, name)
  select v_user_id, r.name from unnest(v_requested) as r (name)
  on conflict do nothing;

  delete from public.availability where user_id = v_user_id;
  -- 연속 구간 찾기: 정렬된 시각에서 순번을 빼면 연속된 시각끼리 같은 값(grp)이 된다.
  insert into public.availability (user_id, weekday, start_hour, end_hour)
  select v_user_id, d.weekday, min(slot.hour), max(slot.hour) + 1
  from (
    select
      s.hour,
      s.is_weekend,
      s.hour - row_number() over (partition by s.is_weekend order by s.hour) as grp
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
    tags = (
      select coalesce(array_agg(distinct t.tag order by t.tag), '{}')
      from unnest(p_tags) as t (tag)
    ),
    onboarded = true
  where id = v_user_id;
end;
$$;

revoke execute on function public.save_my_preferences(bigint[], text[], bigint[], text[], integer[], integer[])
  from public, anon;
grant execute on function public.save_my_preferences(bigint[], text[], bigint[], text[], integer[], integer[])
  to authenticated;
