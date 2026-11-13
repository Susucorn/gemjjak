-- 1:1 채팅: 같은 두 사람의 방은 하나만, 읽음 시각, 대화 목록 함수

-- ---------------------------------------------------------------------------
-- 같은 두 사람 사이의 1:1 방은 하나만 만든다.
-- direct_key = 두 사용자 id를 정렬해 이은 값. 그룹 방은 null이다.
-- ---------------------------------------------------------------------------

alter table public.chat_rooms add column direct_key text unique;

-- direct_key는 start_direct_chat만 정한다. 사용자가 직접 넣어 남의 방 자리를 차지하지 못하게 막는다.
revoke insert, update on public.chat_rooms from anon, authenticated;
grant insert (name, is_group, created_by) on public.chat_rooms to authenticated;

-- ---------------------------------------------------------------------------
-- 읽음 시각: 이 시각 이후 상대가 보낸 메시지가 안 읽은 메시지다.
-- ---------------------------------------------------------------------------

alter table public.chat_members add column last_read_at timestamptz not null default now();

create policy "chat_members_update_own" on public.chat_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.chat_members from anon, authenticated;
grant update (last_read_at) on public.chat_members to authenticated;

-- ---------------------------------------------------------------------------
-- start_direct_chat: 상대와의 1:1 방을 찾거나 만들어 id를 돌려준다.
-- 방 만들기와 두 사람 넣기를 한 번에 해야 해서 security definer로 실행한다.
-- 호출자는 auth.uid()로만 정하므로 남의 이름으로 방을 만들 수 없다.
-- ---------------------------------------------------------------------------

create function public.start_direct_chat(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_key text;
  v_room uuid;
begin
  if v_me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if p_other_id is null or p_other_id = v_me then
    raise exception 'invalid chat partner' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_id and onboarded) then
    raise exception 'unknown user' using errcode = '22023';
  end if;

  v_key := least(v_me::text, p_other_id::text) || ':' || greatest(v_me::text, p_other_id::text);

  insert into public.chat_rooms (is_group, created_by, direct_key)
  values (false, v_me, v_key)
  on conflict (direct_key) do nothing
  returning id into v_room;

  if v_room is null then
    select id into v_room from public.chat_rooms where direct_key = v_key;
  end if;

  -- 전에 방을 나갔던 사람도 다시 넣는다.
  insert into public.chat_members (room_id, user_id)
  values (v_room, v_me), (v_room, p_other_id)
  on conflict do nothing;

  return v_room;
end;
$$;

revoke execute on function public.start_direct_chat(uuid) from public, anon;
grant execute on function public.start_direct_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_chats: 내 1:1 대화 목록. 최근 메시지 순.
-- RLS를 그대로 따르도록 security invoker로 실행한다. 내가 속한 방만 보인다.
-- ---------------------------------------------------------------------------

create function public.list_my_chats()
returns table (
  room_id uuid,
  other_id uuid,
  nickname text,
  avatar_url text,
  last_message text,
  last_sender_id uuid,
  last_at timestamptz,
  unread_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    other.user_id,
    p.nickname,
    p.avatar_url,
    last.content,
    last.sender_id,
    coalesce(last.created_at, r.created_at),
    (
      select count(*)::integer
      from public.messages unread
      where unread.room_id = r.id
        and unread.sender_id <> me.user_id
        and unread.created_at > me.last_read_at
    )
  from public.chat_members me
  join public.chat_rooms r on r.id = me.room_id and not r.is_group
  join public.chat_members other on other.room_id = r.id and other.user_id <> me.user_id
  join public.profiles p on p.id = other.user_id
  left join lateral (
    select m.content, m.sender_id, m.created_at
    from public.messages m
    where m.room_id = r.id
    order by m.created_at desc
    limit 1
  ) last on true
  where me.user_id = (select auth.uid())
  order by coalesce(last.created_at, r.created_at) desc;
$$;

revoke execute on function public.list_my_chats() from public, anon;
grant execute on function public.list_my_chats() to authenticated;
