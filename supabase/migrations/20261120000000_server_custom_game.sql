-- 서버 대표 게임을 목록에 없는 이름으로 직접 입력할 수 있게 한다.
-- 목록의 게임이면 game_id, 직접 입력이면 custom_game에 이름을 넣는다. 둘 다 비면 "여러 게임"이다.
-- 나중에 AI 검색이 서버도 찾을 때 이 이름을 쓴다.

alter table public.servers
  add column custom_game text
    check (custom_game is null or char_length(btrim(custom_game)) between 1 and 40),
  add constraint servers_one_game check (game_id is null or custom_game is null);

grant insert (custom_game), update (custom_game) on public.servers to authenticated;
