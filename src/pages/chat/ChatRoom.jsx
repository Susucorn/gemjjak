import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { BackIcon } from '../../components/ui/BackIcon'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useLoader } from '../../hooks/useLoader'
import { compatibility } from '../../lib/compatibility'
import {
  MESSAGE_MAX_LENGTH,
  fetchDirectRoom,
  fetchMessages,
  markRead,
  sendMessage,
  subscribeToMessages,
} from '../../services/chatService'
import { fetchPlayers } from '../../services/matchService'
import { formatDivider, formatTime, isDifferentDay } from './chatTime'
import styles from './Chat.module.css'

/** 대화방: 방 정보·메시지·두 사람 궁합을 불러온 뒤 대화 화면을 그린다. */
export function ChatRoom({ roomId, onActivity }) {
  const { user } = useAuth()

  const load = useCallback(async () => {
    const [room, messages] = await Promise.all([
      fetchDirectRoom(roomId, user.id),
      fetchMessages(roomId),
    ])
    if (!room?.other) return { room: null }
    // 궁합은 상단 안내용이라 실패해도 대화는 열어 둔다.
    const match = await fetchPlayers(user.id, [user.id, room.other.id]).then(
      ({ me, others }) => (me && others[0] ? compatibility(me, others[0]) : null),
      () => null,
    )
    return { room, messages, match }
  }, [roomId, user.id])
  const loaded = useLoader(load)

  if (loaded.status === 'loading') {
    return (
      <section className={styles.roomPanel}>
        <p className={styles.listStatus} role="status">
          대화를 불러오는 중이에요
        </p>
      </section>
    )
  }
  if (loaded.status === 'error') {
    return (
      <section className={styles.roomPanel}>
        <div className={styles.listStatus}>
          <p>대화를 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      </section>
    )
  }
  if (!loaded.data.room) {
    return (
      <section className={styles.roomPanel}>
        <div className={styles.listStatus}>
          <p>대화방을 찾을 수 없어요</p>
          <Link to="/chat" className={styles.listEmptyLink}>
            대화 목록으로
          </Link>
        </div>
      </section>
    )
  }

  return <Conversation {...loaded.data} myId={user.id} onActivity={onActivity} />
}

/** 처음 말을 걸 때 고를 수 있는 문장. 공통 게임이 있으면 그 게임 이름을 넣는다. */
function quickReplies(match) {
  const game = match?.commonGames[0]
  return [
    '안녕하세요! 추천 보고 연락드려요 🙌',
    game ? `${game} 같이 하실래요?` : '같이 게임하실래요?',
    '주로 몇 시에 접속하세요?',
    '디스코드 아이디 알려 주실래요?',
  ]
}

function Conversation({ room, messages: initialMessages, match, myId, onActivity }) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const { other } = room
  const hasSentAny = messages.some((message) => message.sender_id === myId)

  // 같은 메시지가 보낸 결과와 실시간 알림으로 두 번 들어올 수 있어 id로 거른다.
  const addMessage = useCallback((message) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
  }, [])

  // 방에 들어오면 읽음 처리하고, 상대 메시지가 새로 오면 다시 읽음 처리한다.
  useEffect(() => {
    markRead(room.roomId, myId).then(onActivity, () => {})
    return subscribeToMessages((message) => {
      addMessage(message)
      if (message.sender_id !== myId) markRead(room.roomId, myId).then(onActivity, () => {})
    }, room.roomId)
  }, [room.roomId, myId, addMessage, onActivity])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSend(event) {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || isSending) return
    setIsSending(true)
    setSendError(null)
    try {
      addMessage(await sendMessage(room.roomId, content))
      setDraft('')
      onActivity()
    } catch {
      setSendError('보내지 못했어요. 다시 시도해 주세요.')
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <section className={styles.roomPanel} aria-label={`${other.nickname}님과의 대화`}>
      <header className={styles.roomHeader}>
        <Link to="/chat" className={styles.backLink} aria-label="대화 목록으로">
          <BackIcon />
        </Link>
        <Avatar src={other.avatar_url} name={other.nickname} size={40} />
        <div className={styles.roomHeaderText}>
          <h2 className={styles.roomHeaderName}>{other.nickname}</h2>
          {other.bio && <p className={styles.roomHeaderBio}>{other.bio}</p>}
        </div>
      </header>

      {match && (
        <p className={styles.matchBanner}>
          <strong>궁합 {match.score}%</strong>
          {match.reasons.slice(0, 2).map((reason) => (
            <span key={reason}> · {reason}</span>
          ))}
        </p>
      )}

      <ol className={styles.messages} aria-label="메시지" aria-live="polite">
        {messages.length === 0 && (
          <li className={styles.messagesEmpty}>
            {other.nickname}님에게 첫 메시지를 보내 보세요.
            <br />
            아래 문장을 눌러 바로 쓸 수도 있어요.
          </li>
        )}
        {messages.map((message, index) => {
          const mine = message.sender_id === myId
          const previous = messages[index - 1]
          const showDivider = !previous || isDifferentDay(previous.created_at, message.created_at)
          return (
            <Fragment key={message.id}>
              {showDivider && (
                <li className={styles.divider}>
                  <span>{formatDivider(message.created_at)}</span>
                </li>
              )}
              <li className={`${styles.message} ${mine ? styles.mine : styles.theirs}`}>
                <p className={styles.bubble}>{message.content}</p>
                <time className={styles.time} dateTime={message.created_at}>
                  {formatTime(message.created_at)}
                </time>
              </li>
            </Fragment>
          )
        })}
        <li ref={endRef} aria-hidden="true" />
      </ol>

      <div className={styles.composer}>
        {!hasSentAny && (
          <div className={styles.quickReplies} role="group" aria-label="빠른 답장">
            {quickReplies(match).map((text) => (
              <button
                key={text}
                type="button"
                className={styles.quickReply}
                onClick={() => {
                  setDraft(text)
                  inputRef.current?.focus()
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}
        {sendError && (
          <p className={styles.sendError} role="alert">
            {sendError}
          </p>
        )}
        <form className={styles.inputRow} onSubmit={handleSend}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={draft}
            rows={1}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder="메시지 보내기"
            aria-label="메시지"
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter로 보내고 Shift+Enter로 줄을 바꾼다. 한글 조합 중 Enter는 무시한다.
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                handleSend(event)
              }
            }}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!draft.trim() || isSending}
            aria-busy={isSending}
          >
            보내기
          </button>
        </form>
      </div>
    </section>
  )
}
