import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchUnreadCount, subscribeToMessages } from '../services/chatService'
import { UnreadChatsContext } from './unreadChatsContext'

/**
 * 안 읽은 채팅 수를 앱 전체에 알려 준다. 채팅 탭 배지가 이 값을 쓴다.
 * 새 메시지가 오거나, 화면으로 돌아오거나, 대화방에서 읽음 처리한 뒤(refresh) 다시 센다.
 */
export function UnreadChatsProvider({ children }) {
  const [count, setCount] = useState(0)
  // 여러 요청이 겹치면 마지막에 보낸 요청의 결과만 쓴다.
  // 읽음 처리 전에 보낸 요청이 늦게 도착해 배지가 되살아나는 것을 막는다.
  const latestRequest = useRef(0)

  const refresh = useCallback(() => {
    if (!supabase) return
    const request = ++latestRequest.current
    fetchUnreadCount().then(
      (next) => {
        if (request === latestRequest.current) setCount(next)
      },
      () => {},
    )
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    refresh()
    const unsubscribe = subscribeToMessages(() => refresh())
    // 탭을 오래 비워 두면 실시간 연결이 끊길 수 있어 돌아올 때 다시 센다.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const value = useMemo(() => ({ count, refresh }), [count, refresh])
  return <UnreadChatsContext.Provider value={value}>{children}</UnreadChatsContext.Provider>
}
