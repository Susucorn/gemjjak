import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUnreadChats } from '../hooks/useUnreadChats'
import { ChatList } from './chat/ChatList'
import { ChatRoom, NewChat } from './chat/ChatRoom'
import styles from './chat/Chat.module.css'

/**
 * /chat, /chat/:roomId, /chat/new/:userId(아직 방이 없는 새 대화)
 * 데스크톱(1024px 이상): 왼쪽 목록 + 오른쪽 대화방 2단
 * 모바일: /chat은 목록만, 대화방은 탭바를 덮는 전체 화면으로 뜬다.
 */
export function Chat() {
  const { roomId, userId } = useParams()
  const { refresh: refreshUnread } = useUnreadChats()
  // 대화방에서 읽음 처리나 전송을 하면 목록의 안 읽은 수·순서와 탭 배지를 다시 읽는다.
  const [listKey, setListKey] = useState(0)
  const handleActivity = useCallback(() => {
    setListKey((key) => key + 1)
    refreshUnread()
  }, [refreshUnread])

  const isOpen = Boolean(roomId || userId)

  return (
    <div className={`${styles.chat} ${isOpen ? styles.chatWithRoom : ''}`}>
      <ChatList activeRoomId={roomId} refreshKey={listKey} />
      {roomId && <ChatRoom key={roomId} roomId={roomId} onActivity={handleActivity} />}
      {userId && <NewChat key={userId} otherId={userId} onActivity={handleActivity} />}
      {!isOpen && (
        <section className={`${styles.roomPanel} ${styles.noRoom}`} aria-hidden="true">
          <p>왼쪽에서 대화를 고르세요</p>
        </section>
      )}
    </div>
  )
}
