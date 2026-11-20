-- 자주 쓰는데 빠져 있던 게임 줄임말·다른 이름을 별명에 더한다.
-- 별명은 AI 탐색, 필터 탐색, 커뮤니티 검색, 서버 대표 게임 고르기, 직접 입력 게임 맞추기에 쓰인다.
-- 이름 비교는 normalize_label(띄어쓰기·대소문자·기호 무시)로 하므로,
-- 게임 이름이나 기존 별명과 정규화했을 때 같은 것은 넣지 않는다. 여러 번 실행해도 같다.

with extra (name, aliases) as (
  values
    ('붕괴: 스타레일', array['붕스', 'Honkai Star Rail', 'HSR']),
    ('FC 온라인', array['피온', '피파4', '피파온라인4']),
    ('배틀그라운드', array['펍지', 'Battlegrounds']),
    ('디아블로 IV', array['디아블로', '디아', 'Diablo 4']),
    ('몬스터 헌터 와일즈', array['몬스터 헌터', '와일즈']),
    ('에이펙스 레전드', array['에이펙스']),
    ('로블록스', array['로블']),
    ('블루 아카이브', array['블루아카'])
)
update public.games g
set aliases = g.aliases || array(
  select a.alias
  from unnest(extra.aliases) with ordinality as a (alias, ord)
  where not exists (
    select 1
    from unnest(array[g.name] || g.aliases) as l (label)
    where public.normalize_label(l.label) = public.normalize_label(a.alias)
  )
  order by a.ord
)
from extra
where g.name = extra.name;
