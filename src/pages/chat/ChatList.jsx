import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { listMyChats, subscribeToMessages } from '../../services/chatService'
import { formatListTime } from './chatTime'
import styles from './Chat.module.css'

/**
 * 내 1:1 대화 목록. 새 메시지가 오면 목록을 다시 읽어 순서와 안 읽은 수를 맞춘다.
 * refreshKey가 바뀌어도 다시 읽는다(대화방에서 읽음 처리한 뒤 등).
 */
export function ChatList({ activeRoomId, refreshKey }) {
  const { user } = useAuth()
  const [state, setState] = useState({ status: 'loading', chats: [] })

  // 이미 목록이 보이는 중이면 다시 읽다 실패해도 기존 목록을 그대로 둔다.
  const refresh = useCallback(
    () =>
      listMyChats().then(
        (chats) => setState({ status: 'ready', chats }),
        () => setState((prev) => (prev.status === 'ready' ? prev : { ...prev, status: 'error' })),
      ),
    [],
  )

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  useEffect(() => subscribeToMessages(() => refresh()), [refresh])

  return (
    <section className={styles.list} aria-labelledby="chat-list-title">
      <h1 id="chat-list-title" className={styles.listTitle}>
        채팅
      </h1>

      {state.status === 'loading' && (
        <p className={styles.listStatus} role="status">
          불러오는 중이에요
        </p>
      )}
      {state.status === 'error' && (
        <div className={styles.listStatus}>
          <p>대화 목록을 불러오지 못했어요</p>
          <Button variant="secondary" onClick={refresh}>
            다시 시도
          </Button>
        </div>
      )}
      {state.status === 'ready' && state.chats.length === 0 && (
        <div className={styles.listEmpty}>
          <p className={styles.listEmptyTitle}>아직 대화가 없어요</p>
          <p>홈에서 궁합 높은 게이머에게 [채팅하기]로 말을 걸어 보세요.</p>
          <Link to="/" className={styles.listEmptyLink}>
            추천 게이머 보러 가기
          </Link>
        </div>
      )}
      {state.status === 'ready' && state.chats.length > 0 && (
        <ul className={styles.rooms}>
          {state.chats.map((chat) => {
            const preview = chat.last_message
              ? `${chat.last_sender_id === user.id ? '나: ' : ''}${chat.last_message}`
              : '대화를 시작해 보세요'
            return (
              <li key={chat.room_id}>
                <Link
                  to={`/chat/${chat.room_id}`}
                  className={`${styles.room} ${chat.room_id === activeRoomId ? styles.roomActive : ''}`}
                  aria-current={chat.room_id === activeRoomId ? 'page' : undefined}
                >
                  <Avatar src={chat.avatar_url} name={chat.nickname} size={48} />
                  <span className={styles.roomText}>
                    <span className={styles.roomTop}>
                      <span className={styles.roomName}>{chat.nickname}</span>
                      <span className={styles.roomTime}>{formatListTime(chat.last_at)}</span>
                    </span>
                    <span className={styles.roomBottom}>
                      <span className={styles.roomPreview}>{preview}</span>
                      {chat.unread_count > 0 && (
                        <span
                          className={styles.unread}
                          aria-label={`안 읽은 메시지 ${chat.unread_count}개`}
                        >
                          {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
