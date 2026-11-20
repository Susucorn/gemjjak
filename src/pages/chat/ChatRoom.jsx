import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { BackIcon } from '../../components/ui/BackIcon'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useLoader } from '../../hooks/useLoader'
import { compatibility } from '../../lib/compatibility'
import {
  MESSAGE_MAX_LENGTH,
  clearChat,
  fetchChatPartner,
  fetchDirectRoom,
  fetchMessages,
  findDirectChat,
  leaveChat,
  markRead,
  sendDirectMessage,
  sendMessage,
  subscribeToMessages,
} from '../../services/chatService'
import { fetchPlayers } from '../../services/matchService'
import { formatDivider, formatTime, isDifferentDay } from './chatTime'
import styles from './Chat.module.css'

// 궁합은 상단 안내용이라 실패해도 대화는 열어 둔다.
function loadMatch(myId, otherId) {
  return fetchPlayers(myId, [myId, otherId]).then(
    ({ me, others }) => (me && others[0] ? compatibility(me, others[0]) : null),
    () => null,
  )
}

/** 대화방: 방 정보·메시지·두 사람 궁합을 불러온 뒤 대화 화면을 그린다. */
export function ChatRoom({ roomId, onActivity }) {
  const { user } = useAuth()

  const load = useCallback(async () => {
    const [room, messages] = await Promise.all([
      fetchDirectRoom(roomId, user.id),
      fetchMessages(roomId),
    ])
    if (!room?.other) return { room: null }
    const match = await loadMatch(user.id, room.other.id)
    return { room, messages, match }
  }, [roomId, user.id])
  const loaded = useLoader(load)

  if (loaded.status === 'loading') return <RoomLoading />
  if (loaded.status === 'error') return <RoomError onRetry={loaded.reload} />
  if (!loaded.data.room) return <RoomNotFound text="대화방을 찾을 수 없어요" />

  return <Conversation {...loaded.data} myId={user.id} onActivity={onActivity} />
}

/**
 * [채팅하기]로 들어온 새 대화. 방은 첫 메시지를 보낼 때 만든다.
 * 이미 이 상대와 방이 있으면 그 방으로 바로 옮긴다.
 */
export function NewChat({ otherId, onActivity }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (otherId === user.id) return { other: null }
    const [roomId, other] = await Promise.all([findDirectChat(otherId), fetchChatPartner(otherId)])
    if (roomId) return { roomId }
    if (!other) return { other: null }
    return { other, match: await loadMatch(user.id, otherId) }
  }, [otherId, user.id])
  const loaded = useLoader(load)

  const existingRoomId = loaded.data?.roomId
  useEffect(() => {
    if (existingRoomId) navigate(`/chat/${existingRoomId}`, { replace: true })
  }, [existingRoomId, navigate])

  const openRoom = useCallback(
    (roomId) => navigate(`/chat/${roomId}`, { replace: true }),
    [navigate],
  )

  if (loaded.status === 'loading' || existingRoomId) return <RoomLoading />
  if (loaded.status === 'error') return <RoomError onRetry={loaded.reload} />
  if (!loaded.data.other) return <RoomNotFound text="대화 상대를 찾을 수 없어요" />

  return (
    <Conversation
      room={{ roomId: null, other: loaded.data.other }}
      messages={[]}
      match={loaded.data.match}
      myId={user.id}
      onActivity={onActivity}
      onRoomCreated={openRoom}
    />
  )
}

function RoomLoading() {
  return (
    <section className={styles.roomPanel}>
      <p className={styles.listStatus} role="status">
        대화를 불러오는 중이에요
      </p>
    </section>
  )
}

function RoomError({ onRetry }) {
  return (
    <section className={styles.roomPanel}>
      <div className={styles.listStatus}>
        <p>대화를 불러오지 못했어요</p>
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    </section>
  )
}

function RoomNotFound({ text }) {
  return (
    <section className={styles.roomPanel}>
      <div className={styles.listStatus}>
        <p>{text}</p>
        <Link to="/chat" className={styles.listEmptyLink}>
          대화 목록으로
        </Link>
      </div>
    </section>
  )
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

/**
 * 대화 화면. room.roomId가 null이면 아직 방이 없는 새 대화라서,
 * 첫 메시지를 보낼 때 방을 만들고 onRoomCreated(방 id)를 부른다.
 */
function Conversation({ room, messages: initialMessages, match, myId, onActivity, onRoomCreated }) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [otherLeft, setOtherLeft] = useState(Boolean(room.otherLeft))
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { other } = room
  const hasSentAny = messages.some((message) => message.sender_id === myId)

  // 같은 메시지가 보낸 결과와 실시간 알림으로 두 번 들어올 수 있어 id로 거른다.
  const addMessage = useCallback((message) => {
    setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]))
  }, [])

  // 방에 들어오면 읽음 처리하고, 상대 메시지가 새로 오면 다시 읽음 처리한다.
  useEffect(() => {
    if (!room.roomId) return undefined
    markRead(room.roomId).then(onActivity, () => {})
    return subscribeToMessages((message) => {
      addMessage(message)
      if (message.kind === 'leave') setOtherLeft(true)
      if (message.sender_id !== myId) markRead(room.roomId).then(onActivity, () => {})
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
      if (!room.roomId) {
        // 화면이 새 방으로 바뀌므로 입력값은 비우지 않아도 된다.
        const newRoomId = await sendDirectMessage(other.id, content)
        onActivity()
        onRoomCreated(newRoomId)
        return
      }
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

  async function handleClear() {
    if (!window.confirm('대화 내용을 삭제할까요? 내 화면에서만 지워지고 상대에게는 남아 있어요.')) {
      return
    }
    setActionError(null)
    try {
      await clearChat(room.roomId)
      onActivity()
      navigate('/chat', { replace: true })
    } catch {
      setActionError('대화를 삭제하지 못했어요. 다시 시도해 주세요.')
    }
  }

  async function handleLeave() {
    const message = otherLeft
      ? '채팅방을 나갈까요? 대화 내용이 모두 사라져요.'
      : `채팅방을 나갈까요? 대화 내용이 모두 사라지고, ${other.nickname}님에게 나갔다고 알려져요.`
    if (!window.confirm(message)) return
    setActionError(null)
    try {
      await leaveChat(room.roomId)
      onActivity()
      navigate('/chat', { replace: true })
    } catch {
      setActionError('채팅방을 나가지 못했어요. 다시 시도해 주세요.')
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
        {room.roomId && <RoomMenu onClear={handleClear} onLeave={handleLeave} />}
      </header>

      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}

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
              {message.kind === 'leave' ? (
                <li className={styles.notice}>
                  <span>{other.nickname}님이 채팅방을 나갔어요</span>
                </li>
              ) : (
                <li className={`${styles.message} ${mine ? styles.mine : styles.theirs}`}>
                  <p className={styles.bubble}>{message.content}</p>
                  <time className={styles.time} dateTime={message.created_at}>
                    {formatTime(message.created_at)}
                  </time>
                </li>
              )}
            </Fragment>
          )
        })}
        <li ref={endRef} aria-hidden="true" />
      </ol>

      {otherLeft ? (
        <div className={`${styles.composer} ${styles.closed}`}>
          <p>더 이상 메시지를 보낼 수 없는 대화방이에요.</p>
          <Link to={`/users/${other.id}`} className={styles.closedLink}>
            프로필에서 새로 대화하기
          </Link>
        </div>
      ) : (
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
      )}
    </section>
  )
}

/**
 * 대화방 오른쪽 위 [⋯] 메뉴: 대화 내용 삭제, 채팅방 나가기.
 * 바깥을 누르거나 Esc를 누르면 닫히고, 열면 첫 항목에 초점이 간다.
 */
function RoomMenu({ onClear, onLeave }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const firstItemRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!isOpen) return undefined
    firstItemRef.current?.focus()
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setIsOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  function choose(action) {
    setIsOpen(false)
    action()
  }

  return (
    <div ref={wrapRef} className={styles.menuWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.menuButton}
        aria-label="채팅방 메뉴"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {isOpen && (
        <div id={menuId} className={styles.menu}>
          <button
            ref={firstItemRef}
            type="button"
            className={styles.menuItem}
            onClick={() => choose(onClear)}
          >
            대화 내용 삭제
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => choose(onLeave)}
          >
            채팅방 나가기
          </button>
        </div>
      )}
    </div>
  )
}
