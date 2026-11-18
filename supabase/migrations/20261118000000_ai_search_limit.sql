-- AI 검색은 Claude API 비용이 들어 한 사람이 하루(한국 시간)에 2번까지만 쓴다.
-- ai-search Edge Function이 Claude를 부르기 전에 남은 횟수를 확인하고, 답을 받은 뒤에만 1회를 쓴다.
-- 그래서 AI가 실패한 검색은 횟수에서 빠지지 않는다.
-- 사용자는 자기 기록을 읽기만 할 수 있고, 횟수는 아래 함수로만 바뀐다.

create table public.ai_search_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.ai_search_usage enable row level security;

create policy "ai_search_usage_select_own" on public.ai_search_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.ai_search_usage from anon, authenticated;

create function public.ai_search_daily_limit()
returns integer
language sql
immutable
as $$ select 2 $$;

-- 오늘 남은 횟수(0~2)
create function public.ai_search_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    0,
    public.ai_search_daily_limit() - coalesce((
      select u.count
      from public.ai_search_usage u
      where u.user_id = auth.uid()
        and u.day = (now() at time zone 'Asia/Seoul')::date
    ), 0)
  );
$$;

-- 1회를 쓰고 남은 횟수를 돌려준다. 이미 다 썼으면 오류를 낸다.
create function public.consume_ai_search()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.ai_search_usage as u (user_id, day, count)
  values (v_user, v_day, 1)
  on conflict (user_id, day) do update
    set count = u.count + 1
    where u.count < public.ai_search_daily_limit()
  returning u.count into v_count;

  if v_count is null then
    raise exception 'daily limit reached' using errcode = 'P0001';
  end if;

  return public.ai_search_daily_limit() - v_count;
end;
$$;

revoke execute on function public.ai_search_remaining() from public, anon;
revoke execute on function public.consume_ai_search() from public, anon;
grant execute on function public.ai_search_remaining() to authenticated;
grant execute on function public.consume_ai_search() to authenticated;
