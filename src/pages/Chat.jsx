import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChatList } from './chat/ChatList'
import { ChatRoom } from './chat/ChatRoom'
import styles from './chat/Chat.module.css'

/**
 * /chat, /chat/:roomId
 * 데스크톱(1024px 이상): 왼쪽 목록 + 오른쪽 대화방 2단
 * 모바일: /chat은 목록만, /chat/:roomId는 대화방이 탭바를 덮는 전체 화면으로 뜬다.
 */
export function Chat() {
  const { roomId } = useParams()
  // 대화방에서 읽음 처리나 전송을 하면 목록의 안 읽은 수·순서를 다시 읽는다.
  const [listKey, setListKey] = useState(0)
  const handleActivity = useCallback(() => setListKey((key) => key + 1), [])

  return (
    <div className={`${styles.chat} ${roomId ? styles.chatWithRoom : ''}`}>
      <ChatList activeRoomId={roomId} refreshKey={listKey} />
      {roomId ? (
        <ChatRoom key={roomId} roomId={roomId} onActivity={handleActivity} />
      ) : (
        <section className={`${styles.roomPanel} ${styles.noRoom}`} aria-hidden="true">
          <p>왼쪽에서 대화를 고르세요</p>
        </section>
      )}
    </div>
  )
}
