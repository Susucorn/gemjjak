-- 회원 탈퇴: 로그인한 사람이 자기 계정과 데이터를 모두 지운다.
--
-- auth.users 행을 지우면 cascade로 아래가 함께 사라진다.
--   auth: identities, sessions, mfa 등 로그인 기록
--   public: profiles → user_games, user_genres, availability, user_custom_*,
--           game_requests, ai_search_usage, servers(내가 등록한 서버),
--           chat_members(내 참여 기록), messages(내가 보낸 메시지)
-- chat_rooms.created_by는 set null이라 방 자체는 남는다. 상대만 남은 1:1 방은 목록에서도
-- 보이지 않고(list_my_chats가 상대 멤버를 join한다) 상대가 보낸 메시지만 남게 되므로,
-- 내가 들어가 있던 1:1 방은 먼저 통째로 지운다. 상대 메시지도 cascade로 함께 지워진다.
--
-- auth.users는 클라이언트가 직접 지울 수 없어서 security definer(소유자 postgres)로 실행한다.
-- 지우는 대상은 auth.uid() 한 사람뿐이다.

create function public.delete_my_account()
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

  delete from public.chat_rooms r
  where not r.is_group
    and exists (
      select 1 from public.chat_members m where m.room_id = r.id and m.user_id = v_me
    );

  delete from auth.users where id = v_me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
