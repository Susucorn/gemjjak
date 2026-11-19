import { useContext } from 'react'
import { UnreadChatsContext } from '../contexts/unreadChatsContext'

/** { count, refresh }. UnreadChatsProvider 밖에서는 배지 없이 동작하도록 0을 돌려준다. */
export function useUnreadChats() {
  return useContext(UnreadChatsContext) ?? { count: 0, refresh: () => {} }
}
