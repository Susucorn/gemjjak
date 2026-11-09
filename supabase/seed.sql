-- 기본 데이터. 여러 번 실행해도 중복되지 않는다.
-- servers는 실제 초대 링크가 필요해 넣지 않았다. 대시보드에서 직접 추가한다.

insert into public.games (name)
values
  ('원신'),
  ('리그 오브 레전드'),
  ('발로란트'),
  ('붕괴: 스타레일'),
  ('명조')
on conflict (name) do nothing;

-- 태그 목록 초안
insert into public.tag_vocabulary (tag, category, game_id)
values
  ('즐겜', 'style', null),
  ('빡겜', 'style', null),
  ('뉴비환영', 'style', null),
  ('보이스OK', 'style', null),
  ('채팅만', 'style', null),
  ('듀오 구함', 'want', null),
  ('파티원 구함', 'want', null),
  ('친구 구함', 'want', null),
  ('공략 도움', 'want', null)
on conflict do nothing;

insert into public.tag_vocabulary (tag, category, game_id)
select activity.tag, 'activity', games.id
from (
  values
    ('원신', '월드 탐사'),
    ('원신', '비경'),
    ('원신', '나선비경'),
    ('원신', '주간보스'),
    ('리그 오브 레전드', '랭크'),
    ('리그 오브 레전드', '칼바람'),
    ('리그 오브 레전드', '일반'),
    ('발로란트', '랭크'),
    ('발로란트', '일반전'),
    ('발로란트', '내전'),
    ('붕괴: 스타레일', '모의 우주'),
    ('붕괴: 스타레일', '혼돈의 기억'),
    ('붕괴: 스타레일', '허구 이야기'),
    ('명조', '월드 탐사'),
    ('명조', '주간보스')
) as activity (game_name, tag)
join public.games on games.name = activity.game_name
on conflict do nothing;
