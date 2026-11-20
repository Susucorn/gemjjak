-- "주로 하는 콘텐츠" 태그를 게임 전용 용어(나선비경, 혼돈의 기억 등) 대신
-- 어떤 게임을 골라도 똑같이 보이는 대중적인 공통 태그로 바꾼다.
-- 즐겜·빡겜은 이미 플레이 스타일(style)에 있어 여기에는 넣지 않는다.
--
-- 1. 공통 콘텐츠 태그(game_id null)를 넣는다.
-- 2. 사용자 프로필에 저장된 예전 태그를 가장 가까운 새 태그로 옮긴다.
-- 3. 게임 전용 콘텐츠 태그를 지운다.
-- 사용자가 직접 입력한 콘텐츠 태그(user_custom_tags)는 그대로 둔다.

insert into public.tag_vocabulary (tag, category, game_id)
values
  ('경쟁전', 'activity', null),
  ('일반전', 'activity', null),
  ('내전', 'activity', null),
  ('월드 탐사', 'activity', null),
  ('레이드·보스', 'activity', null),
  ('스토리', 'activity', null),
  ('파밍·육성', 'activity', null),
  ('협동', 'activity', null)
on conflict do nothing;

-- 예전 태그 → 새 태그. 표에 없는 태그(스타일·찾는 사람 등)는 그대로 둔다.
with mapping (old_tag, new_tag) as (
  values
    ('랭크', '경쟁전'),
    ('일반', '일반전'),
    ('칼바람', '일반전'),
    ('주간보스', '레이드·보스'),
    ('비경', '레이드·보스'),
    ('나선비경', '레이드·보스'),
    ('혼돈의 기억', '레이드·보스'),
    ('허구 이야기', '레이드·보스'),
    ('모의 우주', '레이드·보스')
)
update public.profiles p
set tags = array(
  select t.tag
  from (
    select distinct on (coalesce(m.new_tag, old.tag))
      coalesce(m.new_tag, old.tag) as tag, old.ord
    from unnest(p.tags) with ordinality as old (tag, ord)
    left join mapping m on m.old_tag = old.tag
    order by coalesce(m.new_tag, old.tag), old.ord
  ) as t
  order by t.tag
)
where p.tags && array(select old_tag from mapping);

delete from public.tag_vocabulary
where category = 'activity' and game_id is not null;
