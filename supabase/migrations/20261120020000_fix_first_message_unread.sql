-- 첫 메시지가 안 읽은 메시지로 세지지 않던 문제
--
-- send_direct_message는 방 만들기·멤버 넣기·첫 메시지 저장을 한 트랜잭션에서 한다.
-- now()는 트랜잭션 시작 시각이라 멤버의 last_read_at(기본값 now())과 메시지의 created_at이 똑같아져
-- "created_at > last_read_at" 조건에 걸리지 않았다. 그래서 받는 사람에게 배지가 뜨지 않았다.
-- 첫 메시지는 실제 시각(clock_timestamp())으로 저장한다.
--
-- 읽음 처리도 브라우저 시계 대신 DB 시각을 쓰게 한다. 브라우저 시계가 빠르면
-- 그 사이에 온 메시지까지 읽은 것으로 처리돼 배지가 빠질 수 있었다.

create or replace function public.send_direct_message(p_other_id uuid, p_content text)
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

  insert into public.messages (room_id, sender_id, content, created_at)
  values (v_room, v_me, v_content, clock_timestamp());

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_chat_read: 이 방을 지금(DB 시각)까지 읽은 것으로 표시한다.
-- ---------------------------------------------------------------------------

create function public.mark_chat_read(p_room_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.chat_members
  set last_read_at = now()
  where room_id = p_room_id
    and user_id = (select auth.uid())
    and left_at is null;
$$;

revoke execute on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 이미 이 문제로 묻힌 첫 메시지를 다시 안 읽은 메시지로 되살린다.
-- 받는 사람의 last_read_at이 상대 메시지 시각과 정확히 같으면, 그 뒤로 읽지 않은 것이다.
-- ---------------------------------------------------------------------------

update public.chat_members cm
set last_read_at = cm.last_read_at - interval '1 microsecond'
where cm.left_at is null
  and exists (
    select 1
    from public.messages m
    where m.room_id = cm.room_id
      and m.sender_id <> cm.user_id
      and m.kind = 'text'
      and m.created_at = cm.last_read_at
  );
