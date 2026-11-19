import { supabase } from '../lib/supabaseClient'

export const MESSAGE_MAX_LENGTH = 2000

/**
 * [채팅하기]가 여는 주소. 방은 아직 만들지 않는다.
 * 이미 대화한 상대면 그 방으로, 아니면 첫 메시지를 쓰는 화면으로 간다.
 */
export function newChatPath(otherId) {
  return `/chat/new/${otherId}`
}

/** 나와 상대가 함께 있는 1:1 방 id. 없으면 null이다. */
export async function findDirectChat(otherId) {
  const { data, error } = await supabase.rpc('find_direct_chat', { p_other_id: otherId })
  if (error) throw error
  return data
}

/** 첫 메시지를 보내면서 방을 만든다(이미 있으면 그 방에 보낸다). 방 id를 돌려준다. */
export async function sendDirectMessage(otherId, content) {
  const { data, error } = await supabase.rpc('send_direct_message', {
    p_other_id: otherId,
    p_content: content.trim(),
  })
  if (error) throw error
  return data
}

/** 메시지 대화 상대 프로필. 온보딩을 마친 사용자만 돌려준다. */
export async function fetchChatPartner(otherId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio')
    .eq('id', otherId)
    .eq('onboarded', true)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 모든 방의 안 읽은 메시지 수. */
export async function fetchUnreadCount() {
  const { data, error } = await supabase.rpc('unread_chat_count')
  if (error) throw error
  return data ?? 0
}

/** 내 1:1 대화 목록. 최근 메시지 순이다. */
export async function listMyChats() {
  const { data, error } = await supabase.rpc('list_my_chats')
  if (error) throw error
  return data
}

/**
 * 방 정보와 상대 프로필. 내가 속하지 않았거나 나간 방이면 null이다(RLS).
 * otherLeft: 상대가 방을 나가서 더 보낼 수 없는 방인지.
 */
export async function fetchDirectRoom(roomId, myId) {
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id, left_at, profiles(id, nickname, avatar_url, bio)')
    .eq('room_id', roomId)
  if (error) throw error
  if (!data.some((member) => member.user_id === myId)) return null
  const other = data.find((member) => member.user_id !== myId)
  return { roomId, other: other?.profiles ?? null, otherLeft: Boolean(other?.left_at) }
}

/** 방을 나간다. 상대에게 나갔다는 안내가 가고, 나는 이 방을 다시 볼 수 없다. */
export async function leaveChat(roomId) {
  const { error } = await supabase.rpc('leave_direct_chat', { p_room_id: roomId })
  if (error) throw error
}

/** 지금까지의 대화를 내 화면에서만 지운다. 상대가 새로 보내면 그 메시지부터 다시 보인다. */
export async function clearChat(roomId) {
  const { error } = await supabase.rpc('clear_direct_chat', { p_room_id: roomId })
  if (error) throw error
}

// kind: 'text'는 일반 메시지, 'leave'는 나가기 안내(content는 쓰지 않는다).
const MESSAGE_COLUMNS = 'id, room_id, sender_id, content, kind, created_at'

/** 최근 메시지부터 limit개를 읽어 오래된 순으로 돌려준다. */
export async function fetchMessages(roomId, limit = 200) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.reverse()
}

export async function sendMessage(roomId, content) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, content: content.trim() })
    .select(MESSAGE_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/** 이 방의 메시지를 지금까지 읽은 것으로 표시한다. */
export async function markRead(roomId, myId) {
  const { error } = await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', myId)
  if (error) throw error
}

/**
 * 새 메시지를 실시간으로 받는다. roomId를 주면 그 방만, 없으면 내가 볼 수 있는 모든 방이다.
 * RLS가 적용되어 내가 속한 방의 메시지만 온다. 돌려준 함수를 부르면 구독을 끊는다.
 */
export function subscribeToMessages(onInsert, roomId = null) {
  const channel = supabase
    .channel(`messages:${roomId ?? 'all'}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        ...(roomId ? { filter: `room_id=eq.${roomId}` } : {}),
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
