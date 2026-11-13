-- 발표·사용성 테스트용 예시 사용자 18명.
-- 마이그레이션이 아니라 필요할 때 한 번 실행하는 파일이다. 여러 번 실행해도 같은 사람이 중복으로 생기지 않는다.
--
-- 실행: npx supabase db query --remote -f supabase/seed/demo_players.sql
-- 삭제: delete from auth.users where email like '%@demo.gemjjak.invalid';
--       (profiles와 취향 데이터는 on delete cascade로 함께 지워진다.)
--
-- 로그인할 수 없는 계정이다. 비밀번호가 없고 이메일 로그인도 꺼져 있다.
-- .invalid 도메인은 실제로 존재할 수 없는 주소라 메일이 나가지 않는다.
--
-- slots: [[요일 목록], 시작 시각, 끝 시각] — 요일은 1(월)~7(일), 끝 시각은 포함하지 않는다.

do $$
declare
  demo jsonb := $json$[
    {"key": "01", "nick": "별빛여행자", "bio": "원신 탐사 좋아해요. 밤에 같이 비경 돌 분!",
     "games": ["원신", "붕괴: 스타레일"], "genres": ["오픈월드 RPG", "수집형 RPG"],
     "tags": ["즐겜", "보이스OK", "월드 탐사", "비경", "친구 구함"],
     "slots": [[[1,2,3,4,5], 21, 24], [[6,7], 14, 18]]},
    {"key": "02", "nick": "칼바람장인", "bio": "칼바람만 3천 판. 듀오 환영",
     "games": ["리그 오브 레전드"], "genres": ["MOBA"],
     "tags": ["즐겜", "보이스OK", "칼바람", "듀오 구함"],
     "slots": [[[1,3,5], 20, 24], [[6], 13, 17]]},
    {"key": "03", "nick": "골드탈출기", "bio": "이번 시즌 플래 목표! 빡겜 듀오 구해요",
     "games": ["리그 오브 레전드", "전략적 팀 전투"], "genres": ["MOBA", "전략·카드"],
     "tags": ["빡겜", "보이스OK", "랭크", "듀오 구함"],
     "slots": [[[1,2,3,4,5], 19, 23]]},
    {"key": "04", "nick": "에임연습중", "bio": "발로 실버. 같이 성장해요",
     "games": ["발로란트", "오버워치 2"], "genres": ["FPS·슈팅"],
     "tags": ["빡겜", "보이스OK", "랭크", "파티원 구함"],
     "slots": [[[2,4], 21, 24], [[6,7], 20, 24]]},
    {"key": "05", "nick": "내전러버", "bio": "금요일마다 발로 내전 열어요",
     "games": ["발로란트"], "genres": ["FPS·슈팅"],
     "tags": ["즐겜", "보이스OK", "내전", "파티원 구함"],
     "slots": [[[5], 20, 24], [[6,7], 15, 22]]},
    {"key": "06", "nick": "단풍잎수집가", "bio": "메이플 15년차. 뉴비 질문 환영",
     "games": ["메이플스토리"], "genres": ["MMORPG"],
     "tags": ["즐겜", "채팅만", "뉴비환영", "공략 도움"],
     "slots": [[[1,2,3,4,5], 22, 24], [[6,7], 10, 14]]},
    {"key": "07", "nick": "로아군단장", "bio": "레이드 고정팟 구해요. 숙련자 위주",
     "games": ["로스트아크"], "custom_games": [], "genres": ["MMORPG"],
     "tags": ["빡겜", "보이스OK", "파티원 구함"], "custom_tags": [["activity", "레이드"]],
     "slots": [[[1,3,5], 20, 24], [[7], 20, 24]]},
    {"key": "08", "nick": "치킨배달부", "bio": "배그 스쿼드 4인 채워요",
     "games": ["배틀그라운드", "에이펙스 레전드"], "genres": ["배틀로얄", "FPS·슈팅"],
     "tags": ["즐겜", "보이스OK", "파티원 구함"],
     "slots": [[[1,2,3,4,5], 22, 24], [[6,7], 21, 24]]},
    {"key": "09", "nick": "개척자랑", "bio": "스타레일 모의 우주 같이 연구해요",
     "games": ["붕괴: 스타레일", "젠레스 존 제로"], "genres": ["수집형 RPG"],
     "tags": ["즐겜", "채팅만", "모의 우주", "혼돈의 기억", "공략 도움"],
     "slots": [[[1,2,3,4,5], 12, 13], [[1,2,3,4,5], 21, 23]]},
    {"key": "10", "nick": "파도타기", "bio": "명조 주간보스 같이 잡아요",
     "games": ["명조", "원신"], "genres": ["오픈월드 RPG"],
     "tags": ["즐겜", "주간보스", "월드 탐사", "친구 구함"],
     "slots": [[[2,4], 20, 23], [[6,7], 13, 17]]},
    {"key": "11", "nick": "드리프트킹", "bio": "카트 스피드전 고수 지망생",
     "custom_games": ["카트라이더 드리프트"], "custom_genres": ["레이싱"],
     "tags": ["빡겜", "보이스OK", "듀오 구함"],
     "slots": [[[1,2,3,4,5], 19, 22]]},
    {"key": "12", "nick": "농장주인", "bio": "스타듀 밸리 멀티 같이 하실 분. 느긋하게 해요",
     "games": ["마인크래프트"], "custom_games": ["스타듀 밸리"], "genres": ["샌드박스·생존"],
     "custom_genres": ["힐링"], "tags": ["즐겜", "채팅만", "뉴비환영", "친구 구함"],
     "custom_tags": [["style", "느긋하게"]],
     "slots": [[[6,7], 10, 16]]},
    {"key": "13", "nick": "블록장인", "bio": "마크 건축 서버 운영 중",
     "games": ["마인크래프트", "로블록스"], "genres": ["샌드박스·생존"],
     "tags": ["즐겜", "보이스OK", "뉴비환영", "친구 구함"],
     "slots": [[[3], 20, 23], [[6,7], 13, 20]]},
    {"key": "14", "nick": "옵치힐러", "bio": "서포터 전문. 탱 구해요",
     "games": ["오버워치 2"], "genres": ["FPS·슈팅"],
     "tags": ["즐겜", "보이스OK", "듀오 구함"],
     "slots": [[[1,2,3,4,5], 20, 23]]},
    {"key": "15", "nick": "피파감독", "bio": "FC 온라인 친선전 상대 구해요",
     "games": ["FC 온라인"], "genres": ["스포츠"],
     "tags": ["빡겜", "채팅만", "친구 구함"],
     "slots": [[[1,2,3,4,5], 23, 24], [[6,7], 22, 24]]},
    {"key": "16", "nick": "던파모험가", "bio": "던파 레이드 같이 가요",
     "games": ["던전앤파이터", "로스트아크"], "genres": ["액션", "MMORPG"],
     "tags": ["즐겜", "보이스OK", "파티원 구함"],
     "slots": [[[1,3,5], 21, 24], [[6], 20, 24]]},
    {"key": "17", "nick": "새내기게이머", "bio": "게임 처음 시작했어요. 친절한 분 찾아요",
     "games": ["리그 오브 레전드", "원신"], "genres": ["MOBA", "오픈월드 RPG"],
     "tags": ["즐겜", "채팅만", "일반", "친구 구함", "공략 도움"],
     "slots": [[[2,4], 19, 22], [[6,7], 14, 17]]},
    {"key": "18", "nick": "새벽감성", "bio": "새벽에만 접속해요. 롤 칼바람 같이",
     "games": ["리그 오브 레전드", "이터널 리턴"], "genres": ["MOBA"],
     "tags": ["즐겜", "채팅만", "칼바람", "듀오 구함"],
     "slots": [[[1,2,3,4,5,6,7], 0, 3]]}
  ]$json$::jsonb;
  item jsonb;
  slot jsonb;
  v_id uuid;
  v_email text;
begin
  for item in select * from jsonb_array_elements(demo)
  loop
    v_email := 'player' || (item ->> 'key') || '@demo.gemjjak.invalid';

    select id into v_id from auth.users where email = v_email;
    if v_id is null then
      v_id := gen_random_uuid();
      -- 토큰 컬럼이 null이면 Supabase 대시보드의 사용자 목록이 깨질 수 있어 빈 문자열을 넣는다.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, '',
        now(), '{"provider": "demo", "providers": ["demo"]}', '{}', now(), now(), '', '', '', ''
      );
    end if;

    -- 회원가입 트리거가 만든 프로필을 채운다.
    update public.profiles
    set
      nickname = item ->> 'nick',
      bio = item ->> 'bio',
      tags = array(select jsonb_array_elements_text(coalesce(item -> 'tags', '[]'))),
      onboarded = true
    where id = v_id;

    delete from public.user_games where user_id = v_id;
    insert into public.user_games (user_id, game_id)
    select v_id, g.id from public.games g
    where g.name in (select jsonb_array_elements_text(coalesce(item -> 'games', '[]')));

    delete from public.user_custom_games where user_id = v_id;
    insert into public.user_custom_games (user_id, name)
    select v_id, n from jsonb_array_elements_text(coalesce(item -> 'custom_games', '[]')) as n;

    delete from public.user_genres where user_id = v_id;
    insert into public.user_genres (user_id, genre_id)
    select v_id, g.id from public.genres g
    where g.name in (select jsonb_array_elements_text(coalesce(item -> 'genres', '[]')));

    delete from public.user_custom_genres where user_id = v_id;
    insert into public.user_custom_genres (user_id, name)
    select v_id, n from jsonb_array_elements_text(coalesce(item -> 'custom_genres', '[]')) as n;

    delete from public.user_custom_tags where user_id = v_id;
    insert into public.user_custom_tags (user_id, category, name)
    select v_id, t ->> 0, t ->> 1 from jsonb_array_elements(coalesce(item -> 'custom_tags', '[]')) as t;

    delete from public.availability where user_id = v_id;
    for slot in select * from jsonb_array_elements(item -> 'slots')
    loop
      insert into public.availability (user_id, weekday, start_hour, end_hour)
      select v_id, d::smallint, (slot ->> 1)::smallint, (slot ->> 2)::smallint
      from jsonb_array_elements_text(slot -> 0) as d
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;

-- 확인용: 예시 사용자별 게임 수와 접속 시간
select p.nickname,
  (select count(*) from public.user_games ug where ug.user_id = p.id)
    + (select count(*) from public.user_custom_games cg where cg.user_id = p.id) as games,
  (select sum(end_hour - start_hour) from public.availability a where a.user_id = p.id) as weekly_hours
from public.profiles p
join auth.users u on u.id = p.id
where u.email like '%@demo.gemjjak.invalid'
order by u.email;
