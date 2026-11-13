-- 서버를 등록하면 바로 커뮤니티에 공개한다.
-- 앱에 관리자 승인 화면이 없어 확인 중(pending) 서버가 계속 남았다.
-- 대신 등록 화면이 디스코드에 초대 링크가 살아 있는지 물어본 뒤에만 저장한다.
-- 관리자는 대시보드에서 status를 'rejected'로 바꿔 숨길 수 있다.

alter table public.servers alter column status set default 'approved';

-- 링크를 바꿔도 다시 확인받지 않는다. 예전 링크 기준 인원 수만 비운다.
create or replace function public.reset_server_status_on_invite_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invite_url is distinct from old.invite_url then
    new.member_count := 0;
    new.online_count := 0;
  end if;
  return new;
end;
$$;

update public.servers set status = 'approved' where status = 'pending';
