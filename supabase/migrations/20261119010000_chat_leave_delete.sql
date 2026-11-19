-- 1:1 채팅방 나가기와 내 화면에서 대화 삭제
--
-- 나가기: 내 참여 기록에 left_at을 남기고 상대에게 "나갔어요" 안내 메시지를 보낸다.
--   나간 사람은 방을 볼 수 없고, 남은 사람은 기록은 보지만 더 보낼 수 없다.
--   방의 direct_key를 비워서 다시 [채팅하기]를 누르면 새 방에서 시작한다.
--   두 사람 모두 나가면 방과 메시지를 지운다.
-- 삭제: 내 cleared_at 이전 메시지를 나에게만 숨긴다. 상대 화면은 그대로다.
--   상대가 새 메시지를 보내면 그 메시지부터 다시 보인다.

-- ---------------------------------------------------------------------------
-- 컬럼
-- ---------------------------------------------------------------------------

alter table public.chat_members
  add column left_at timestamptz,
  add column cleared_at timestamptz;

-- text: 일반 메시지, leave: 나가기 안내(content는 쓰지 않는다)
alter table public.messages
  add column kind text not null default 'text' check (kind in ('text', 'leave'));

-- ---------------------------------------------------------------------------
-- 권한 함수
-- ---------------------------------------------------------------------------

-- 나간 사람은 더 이상 방 멤버가 아니다. 이 함수를 쓰는 모든 정책(방·멤버·메시지 조회)에 적용된다.
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_members
    where room_id = p_room_id
      and user_id = (select auth.uid())
      and left_at is null
  );
$$;

-- 내가 이 메시지를 볼 수 있는지: 방 멤버이고, 내가 대화를 삭제한 시각 이후 메시지다.
create function public.can_see_message(p_room_id uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_members
    where room_id = p_room_id
      and user_id = (select auth.uid())
      and left_at is null
      and (cleared_at is null or p_created_at > cleared_at)
  );
$$;

revoke execute on function public.can_see_message(uuid, timestamptz) from public, anon;
grant execute on function public.can_see_message(uuid, timestamptz) to authenticated;

-- 메시지를 보낼 수 있는 방인지: 아무도 나가지 않은 방이다.
create function public.is_room_open(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.chat_members
    where room_id = p_room_id
      and left_at is not null
  );
$$;

revoke execute on function public.is_room_open(uuid) from public, anon;
grant execute on function public.is_room_open(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 정책
-- ---------------------------------------------------------------------------

drop policy "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select to authenticated using (public.can_see_message(room_id, created_at));

-- 일반 메시지만 직접 보낼 수 있다. 나가기 안내는 leave_direct_chat만 넣는다.
drop policy "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and kind = 'text'
    and public.is_room_member(room_id)
    and public.is_room_open(room_id)
  );

-- 나가기는 안내 메시지와 direct_key 정리가 함께 필요해서 leave_direct_chat으로만 한다.
drop policy "chat_members_delete_self" on public.chat_members;
revoke delete on public.chat_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- leave_direct_chat: 방 나가기
-- ---------------------------------------------------------------------------

create function public.leave_direct_chat(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'login required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.chat_members m
    join public.chat_rooms r on r.id = m.room_id and not r.is_group
    where m.room_id = p_room_id
      and m.user_id = v_me
      and m.left_at is null
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  update public.chat_members
  set left_at = now()
  where room_id = p_room_id and user_id = v_me;

  -- 둘 다 나갔으면 남길 이유가 없다. 멤버와 메시지는 cascade로 함께 지워진다.
  if not exists (
    select 1 from public.chat_members where room_id = p_room_id and left_at is null
  ) then
    delete from public.chat_rooms where id = p_room_id;
    return;
  end if;

  update public.chat_rooms set direct_key = null where id = p_room_id;

  insert into public.messages (room_id, sender_id, content, kind)
  values (p_room_id, v_me, 'left', 'leave');
end;
$$;

revoke execute on function public.leave_direct_chat(uuid) from public, anon;
grant execute on function public.leave_direct_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- clear_direct_chat: 내 화면에서 지금까지의 대화 삭제
-- ---------------------------------------------------------------------------

create function public.clear_direct_chat(p_room_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.chat_members
  set cleared_at = now(), last_read_at = now()
  where room_id = p_room_id
    and user_id = (select auth.uid())
    and left_at is null;
$$;

grant update (cleared_at) on public.chat_members to authenticated;
revoke execute on function public.clear_direct_chat(uuid) from public, anon;
grant execute on function public.clear_direct_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- find_direct_chat: 둘 다 남아 있는 방만 찾는다. 한쪽이 나간 방이면 새로 시작한다.
-- ---------------------------------------------------------------------------

create or replace function public.find_direct_chat(p_other_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select me.room_id
  from public.chat_members me
  join public.chat_rooms r on r.id = me.room_id and not r.is_group
  join public.chat_members other
    on other.room_id = me.room_id and other.user_id = p_other_id and other.left_at is null
  where me.user_id = (select auth.uid())
    and me.left_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- list_my_chats: 마지막 메시지 종류와 상대가 나갔는지를 함께 돌려준다.
-- 반환 열이 바뀌어 지우고 다시 만든다. 메시지 RLS 덕분에 삭제한 대화는 빠진다.
-- ---------------------------------------------------------------------------

drop function public.list_my_chats();

create function public.list_my_chats()
returns table (
  room_id uuid,
  other_id uuid,
  nickname text,
  avatar_url text,
  last_message text,
  last_kind text,
  last_sender_id uuid,
  last_at timestamptz,
  unread_count integer,
  other_left boolean
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
    last.kind,
    last.sender_id,
    last.created_at,
    (
      select count(*)::integer
      from public.messages unread
      where unread.room_id = r.id
        and unread.kind = 'text'
        and unread.sender_id <> me.user_id
        and unread.created_at > me.last_read_at
    ),
    other.left_at is not null
  from public.chat_members me
  join public.chat_rooms r on r.id = me.room_id and not r.is_group
  join public.chat_members other on other.room_id = r.id and other.user_id <> me.user_id
  join public.profiles p on p.id = other.user_id
  join lateral (
    select m.content, m.kind, m.sender_id, m.created_at
    from public.messages m
    where m.room_id = r.id
    order by m.created_at desc
    limit 1
  ) last on true
  where me.user_id = (select auth.uid())
    and me.left_at is null
  order by last.created_at desc;
$$;

revoke execute on function public.list_my_chats() from public, anon;
grant execute on function public.list_my_chats() to authenticated;

-- ---------------------------------------------------------------------------
-- unread_chat_count: 나간 방과 나가기 안내는 세지 않는다.
-- ---------------------------------------------------------------------------

create or replace function public.unread_chat_count()
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
    and me.left_at is null
    and m.kind = 'text'
    and m.sender_id <> me.user_id
    and m.created_at > me.last_read_at;
$$;
