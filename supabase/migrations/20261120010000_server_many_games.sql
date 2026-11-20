-- 서버 대표 게임을 여러 개 고를 수 있게 한다.
--   game_ids      목록에서 고른 게임 games.id (최대 10개)
--   custom_games  목록에 없어 직접 입력한 게임 이름 (최대 10개, 각 40자)
--   둘 다 비면 "여러 게임"이다.
-- 하나만 담던 game_id·custom_game은 배열로 옮긴 뒤 지운다.
-- 배열 원소는 CHECK로 검사할 수 없어 아래 트리거가 검사하고 정리한다.

alter table public.servers
  add column game_ids bigint[] not null default '{}',
  add column custom_games text[] not null default '{}';

update public.servers
set
  game_ids = case when game_id is null then '{}' else array[game_id] end,
  custom_games = case when custom_game is null then '{}' else array[btrim(custom_game)] end;

-- 제약·외래 키·인덱스·열 권한도 열과 함께 사라진다.
alter table public.servers drop constraint servers_one_game;
alter table public.servers drop column custom_game;
alter table public.servers drop column game_id;

-- "내 게임 서버" 찾기(game_ids && 내 게임)용
create index servers_game_ids_idx on public.servers using gin (game_ids);

grant insert (game_ids, custom_games), update (game_ids, custom_games)
  on public.servers to authenticated;

-- ---------------------------------------------------------------------------
-- 저장 전에 게임 목록을 검사하고 정리한다.
--   직접 입력한 이름이 목록 게임의 이름·별명과 같으면 그 게임으로 옮긴다.
--   이름은 앞뒤 공백을 지우고, 정규화했을 때 같은 이름은 하나만 남긴다.
--   없는 게임 id나 개수·길이 초과는 오류를 낸다.
-- ---------------------------------------------------------------------------

create function public.normalize_server_games()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.custom_games := array(
    select c.name
    from (
      select distinct on (public.normalize_label(btrim(raw.name)))
        btrim(raw.name) as name, raw.ord
      from unnest(coalesce(new.custom_games, '{}')) with ordinality as raw (name, ord)
      where public.normalize_label(btrim(raw.name)) <> ''
      order by public.normalize_label(btrim(raw.name)), raw.ord
    ) as c
    order by c.ord
  );

  new.game_ids := array(
    select distinct g.id
    from unnest(coalesce(new.game_ids, '{}') || array(
      select games.id
      from unnest(new.custom_games) as c (name)
      join public.games on exists (
        select 1 from unnest(array[games.name] || games.aliases) as l (label)
        where public.normalize_label(l.label) = public.normalize_label(c.name)
      )
    )) as g (id)
    where g.id is not null
  );

  new.custom_games := array(
    select c.name
    from unnest(new.custom_games) with ordinality as c (name, ord)
    where not exists (
      select 1
      from public.games, unnest(array[games.name] || games.aliases) as l (label)
      where public.normalize_label(l.label) = public.normalize_label(c.name)
    )
    order by c.ord
  );

  if exists (
    select 1 from unnest(new.game_ids) as g (id)
    where not exists (select 1 from public.games where games.id = g.id)
  ) then
    raise exception 'unknown game id' using errcode = '23514';
  end if;
  if cardinality(new.game_ids) > 10 or cardinality(new.custom_games) > 10 then
    raise exception 'too many games' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(new.custom_games) as c (name) where char_length(c.name) > 40) then
    raise exception 'custom game name too long' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger servers_normalize_games
  before insert or update of game_ids, custom_games on public.servers
  for each row execute function public.normalize_server_games();
