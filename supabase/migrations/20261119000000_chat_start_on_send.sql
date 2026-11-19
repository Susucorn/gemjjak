-- 1:1 대화방은 첫 메시지를 보낼 때 만든다. 안 읽은 메시지 수를 탭 배지용으로 따로 센다.

-- ---------------------------------------------------------------------------
-- start_direct_chat은 이제 send_direct_message 안에서만 쓴다.
-- 클라이언트가 직접 부르면 메시지 없는 빈 방이 생기므로 실행 권한을 거둔다.
-- ---------------------------------------------------------------------------

revoke execute on function public.start_direct_chat(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- find_direct_chat: 나와 상대가 모두 들어 있는 1:1 방 id. 없으면 null.
-- RLS를 그대로 따르도록 security invoker로 실행한다.
-- ---------------------------------------------------------------------------

create function public.find_direct_chat(p_other_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select me.room_id
  from public.chat_members me
  join public.chat_rooms r on r.id = me.room_id and not r.is_group
  join public.chat_members other on other.room_id = me.room_id and other.user_id = p_other_id
  where me.user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function public.find_direct_chat(uuid) from public, anon;
grant execute on function public.find_direct_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- send_direct_message: 상대와의 방을 찾거나 만들고, 첫 메시지를 같은 트랜잭션에서 넣는다.
-- 메시지 저장이 실패하면 방도 만들어지지 않는다. 방 id를 돌려준다.
-- ---------------------------------------------------------------------------

create function public.send_direct_message(p_other_id uuid, p_content text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_content text := btrim(p_content);
  v_room uuid;
begin
  if v_me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if v_content is null or char_length(v_content) not between 1 and 2000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;

  v_room := public.start_direct_chat(p_other_id);

  insert into public.messages (room_id, sender_id, content)
  values (v_room, v_me, v_content);

  return v_room;
end;
$$;

revoke execute on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- list_my_chats: 메시지가 하나라도 있는 방만 보여 준다.
-- 예전 방식으로 만들어진 빈 방은 목록에서 빠진다(지우지는 않는다).
-- ---------------------------------------------------------------------------

create or replace function public.list_my_chats()
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
    last.created_at,
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
  join lateral (
    select m.content, m.sender_id, m.created_at
    from public.messages m
    where m.room_id = r.id
    order by m.created_at desc
    limit 1
  ) last on true
  where me.user_id = (select auth.uid())
  order by last.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- unread_chat_count: 내가 속한 모든 방의 안 읽은 메시지 수. 채팅 탭 배지에 쓴다.
-- ---------------------------------------------------------------------------

create function public.unread_chat_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.chat_members me
  join public.messages m on m.room_id = me.room_id
  where me.user_id = (select auth.uid())
    and m.sender_id <> me.user_id
    and m.created_at > me.last_read_at;
$$;

revoke execute on function public.unread_chat_count() from public, anon;
grant execute on function public.unread_chat_count() to authenticated;
