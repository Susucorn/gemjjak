import { supabase } from '../lib/supabaseClient'

export const MESSAGE_MAX_LENGTH = 2000

/** 상대와의 1:1 방을 찾거나 만들어 방 id를 돌려준다. */
export async function startDirectChat(otherId) {
  const { data, error } = await supabase.rpc('start_direct_chat', { p_other_id: otherId })
  if (error) throw error
  return data
}

/** 내 1:1 대화 목록. 최근 메시지 순이다. */
export async function listMyChats() {
  const { data, error } = await supabase.rpc('list_my_chats')
  if (error) throw error
  return data
}

/** 방 정보와 상대 프로필. 내가 속하지 않은 방이면 null이다(RLS). */
export async function fetchDirectRoom(roomId, myId) {
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id, profiles(id, nickname, avatar_url, bio)')
    .eq('room_id', roomId)
  if (error) throw error
  if (!data.some((member) => member.user_id === myId)) return null
  const other = data.find((member) => member.user_id !== myId)
  return { roomId, other: other?.profiles ?? null }
}

const MESSAGE_COLUMNS = 'id, room_id, sender_id, content, created_at'

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
