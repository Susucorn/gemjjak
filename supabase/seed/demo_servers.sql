-- 커뮤니티 탭 시연용: 게임사 공식 디스코드 서버 5개(공개 초대 링크). 배포 전에 지운다.
-- owner_id가 null인 "겜짝 추천" 서버로 넣고 바로 공개(approved)한다.
-- 인원 수는 화면에서 디스코드에 직접 물어보므로 0으로 둔다.
-- 여러 번 실행해도 invite_url이 같으면 건너뛴다.
--
-- 지우기:
--   delete from public.servers where owner_id is null and invite_url in (
--     select 'https://discord.gg/' || code from unnest(array[
--       'leagueoflegends','valorant','genshinimpact','lostark','minecraft']) as code);

insert into public.servers (name, game_id, description, invite_url, status)
select v.name, g.id, v.description, 'https://discord.gg/' || v.code, 'approved'
from (values
  ('League of Legends', '리그 오브 레전드', 'leagueoflegends', '라이엇 게임즈 공식 롤 서버예요. 패치 소식을 보고 같이 할 사람을 구할 수 있어요.'),
  ('VALORANT', '발로란트', 'valorant', '발로란트 공식 서버예요. 듀오·파티원 구하기 채널이 있어요.'),
  ('Genshin Impact Official', '원신', 'genshinimpact', '호요버스 원신 공식 서버예요. 공략과 이벤트 소식을 나눠요.'),
  ('Lost Ark', '로스트아크', 'lostark', '로스트아크 글로벌 공식 서버예요. 레이드 파티를 구해 보세요.'),
  ('MINECRAFT', '마인크래프트', 'minecraft', '마인크래프트 공식 서버예요. 같이 건축하고 탐험할 친구를 찾아요.')
) as v(name, game_name, code, description)
join public.games g on g.name = v.game_name
on conflict (invite_url) do nothing;
