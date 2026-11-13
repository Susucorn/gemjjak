import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { BackIcon } from '../components/ui/BackIcon'
import { Button } from '../components/ui/Button'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { GameTile } from '../components/ui/GameTile'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { WEIGHTS, compatibility } from '../lib/compatibility'
import { startDirectChat } from '../services/chatService'
import { fetchPlayers } from '../services/matchService'
import { fetchApprovedServersOf } from '../services/serverService'
import { DAYS, HOURS } from './onboarding/hours'
import styles from './PlayerProfile.module.css'

/** /users/:userId — 다른 게이머의 프로필과 나와의 궁합 */
export function PlayerProfile() {
  const { userId } = useParams()
  const { user } = useAuth()

  const load = useCallback(async () => {
    const [{ me, others, catalog }, servers] = await Promise.all([
      fetchPlayers(user.id, [user.id, userId]),
      fetchApprovedServersOf(userId),
    ])
    const player = others[0] ?? null
    return {
      me,
      player,
      catalog,
      servers,
      match: me && player ? compatibility(me, player) : null,
    }
  }, [user.id, userId])
  const loaded = useLoader(load)

  if (userId === user.id) return <Navigate to="/profile" replace />

  return (
    <div className={styles.page}>
      <BackButton />
      {loaded.status === 'loading' && (
        <p className={styles.status} role="status">
          프로필을 불러오는 중이에요
        </p>
      )}
      {loaded.status === 'error' && (
        <div className={styles.status}>
          <p>프로필을 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded.status === 'ready' &&
        (loaded.data.player ? (
          <PlayerDetails {...loaded.data} />
        ) : (
          <div className={styles.status}>
            <p>프로필을 찾을 수 없어요</p>
            <Link to="/" className={styles.statusLink}>
              홈으로
            </Link>
          </div>
        ))}
    </div>
  )
}

/** 들어온 곳(홈 등)으로 돌아간다. 주소로 바로 들어왔으면 홈으로 간다. */
function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
      aria-label="뒤로 가기"
    >
      <BackIcon />
    </button>
  )
}

const PART_LABELS = [
  { key: 'game', label: '공통 게임' },
  { key: 'time', label: '접속 시간' },
  { key: 'style', label: '플레이 스타일' },
]

function PlayerDetails({ me, player, catalog, servers, match }) {
  const navigate = useNavigate()
  const [isStartingChat, setIsStartingChat] = useState(false)
  const [chatError, setChatError] = useState(null)

  async function handleChat() {
    setIsStartingChat(true)
    setChatError(null)
    try {
      navigate(`/chat/${await startDirectChat(player.id)}`)
    } catch {
      setChatError('대화방을 열지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsStartingChat(false)
    }
  }

  const commonGames = new Set(match?.commonGames ?? [])
  const commonGenres = new Set(match?.commonGenres ?? [])
  const commonTags = new Set(match?.commonTags ?? [])
  const genreOfGame = (key) => {
    const game = key.startsWith('g:') ? catalog.gameById.get(Number(key.slice(2))) : null
    return game ? catalog.genreById.get(game.genre_id)?.name : undefined
  }

  return (
    <>
      <section className={styles.hero} aria-label={`${player.nickname}님 프로필`}>
        <Avatar src={player.avatarUrl} name={player.nickname} size={80} />
        <h1 className={styles.nickname}>{player.nickname}</h1>
        {player.bio && <p className={styles.bio}>{player.bio}</p>}
        {chatError && (
          <p className={styles.alert} role="alert">
            {chatError}
          </p>
        )}
        <Button
          className={styles.chatButton}
          onClick={handleChat}
          disabled={isStartingChat}
          aria-busy={isStartingChat}
        >
          {isStartingChat ? '대화방 여는 중…' : '채팅하기'}
        </Button>
      </section>

      {match && (
        <section className={styles.card} aria-labelledby="match-title">
          <div className={styles.matchTop}>
            <h2 id="match-title" className={styles.cardTitle}>
              나와의 궁합
            </h2>
            <p className={styles.score}>{match.score}%</p>
          </div>
          <div className={styles.parts}>
            {PART_LABELS.map(({ key, label }) => (
              <div key={key} className={styles.part}>
                <p className={styles.partLabel}>
                  {label}
                  <span>{Math.round(match.parts[key] * 100)}%</span>
                </p>
                <span
                  className={styles.partTrack}
                  role="meter"
                  aria-label={`${label} 일치`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(match.parts[key] * 100)}
                >
                  <span
                    className={styles.partFill}
                    style={{ width: `${match.parts[key] * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
          <p className={styles.weights}>
            점수 = 공통 게임 {WEIGHTS.game * 100}% + 접속 시간 {WEIGHTS.time * 100}% + 플레이 스타일{' '}
            {WEIGHTS.style * 100}%
          </p>
          {match.reasons.length > 0 && (
            <ul className={styles.reasons}>
              {match.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className={styles.sections}>
        <section className={styles.card} aria-labelledby="games-title">
          <h2 id="games-title" className={styles.cardTitle}>
            하는 게임
          </h2>
          <ul className={styles.gameList}>
            {[...player.games].map(([key, name]) => (
              <li key={key} className={styles.gameItem}>
                {key.startsWith('g:') ? (
                  <GameTile name={name} genre={genreOfGame(key)} className={styles.gameTile} />
                ) : (
                  <span className={styles.customTile} aria-hidden="true">
                    {name.slice(0, 1)}
                  </span>
                )}
                <span className={styles.gameName}>{name}</span>
                {commonGames.has(name) && <span className={styles.together}>같이 해요</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.card} aria-labelledby="style-title">
          <h2 id="style-title" className={styles.cardTitle}>
            장르 · 플레이 스타일
          </h2>
          <TagList
            label="좋아하는 장르"
            names={[...player.genres.values()]}
            common={commonGenres}
          />
          <TagList label="태그" names={[...player.tags.values()]} common={commonTags} />
          <p className={styles.legend}>
            <span className={styles.legendCommon} /> 나와 겹치는 항목
          </p>
        </section>

        <section className={`${styles.card} ${styles.wide}`} aria-labelledby="time-title">
          <h2 id="time-title" className={styles.cardTitle}>
            접속 시간 비교
          </h2>
          <WeekCompare me={me} player={player} />
        </section>

        {servers.length > 0 && (
          <section className={`${styles.card} ${styles.wide}`} aria-labelledby="servers-title">
            <h2 id="servers-title" className={styles.cardTitle}>
              운영하는 디스코드 서버
            </h2>
            <ul className={styles.servers}>
              {servers.map((server) => (
                <li key={server.id} className={styles.server}>
                  <span className={styles.serverIcon} aria-hidden="true">
                    <DiscordIcon size={20} />
                  </span>
                  <span className={styles.serverText}>
                    <strong>{server.name}</strong>
                    <span>
                      {catalog.gameById.get(server.game_id)?.name ?? '여러 게임'}
                      {server.member_count > 0 && ` · 멤버 ${server.member_count.toLocaleString()}`}
                    </span>
                  </span>
                  <a
                    href={server.invite_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.join}
                  >
                    참여
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

function TagList({ label, names, common }) {
  if (names.length === 0) return null
  // 겹치는 항목을 앞에 둔다.
  const sorted = [...names].sort((a, b) => Number(common.has(b)) - Number(common.has(a)))
  return (
    <div className={styles.tagGroup}>
      <p className={styles.tagLabel}>{label}</p>
      <ul className={styles.tags}>
        {sorted.map((name) => (
          <li key={name} className={common.has(name) ? styles.tagCommon : styles.tag}>
            {name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 요일별 24칸. 둘 다 접속하는 칸은 진하게, 상대만 접속하는 칸은 연하게 칠한다. */
function WeekCompare({ me, player }) {
  const overlapCount = [...player.hours].filter((cell) => me.hours.has(cell)).length
  return (
    <>
      <p className={styles.overlapSummary}>
        {overlapCount > 0
          ? `일주일에 ${overlapCount}시간 같이 접속해요`
          : '아직 겹치는 접속 시간이 없어요'}
      </p>
      <div className={styles.week}>
        {DAYS.map((day) => (
          <div key={day.key} className={styles.weekRow}>
            <span className={styles.weekDay}>{day.label}</span>
            <span className={styles.weekBar} aria-hidden="true">
              {HOURS.map((hour) => {
                const cell = day.key * 24 + hour
                const theirs = player.hours.has(cell)
                const both = theirs && me.hours.has(cell)
                return (
                  <span
                    key={hour}
                    className={both ? styles.cellBoth : theirs ? styles.cellTheirs : styles.cellOff}
                  />
                )
              })}
            </span>
          </div>
        ))}
        <div className={styles.weekAxis} aria-hidden="true">
          <span />
          <span className={styles.weekAxisLabels}>
            <span>0시</span>
            <span>6시</span>
            <span>12시</span>
            <span>18시</span>
            <span>24시</span>
          </span>
        </div>
      </div>
      <p className={styles.legend}>
        <span className={styles.legendBoth} /> 둘 다 접속
        <span className={styles.legendTheirs} /> {player.nickname}님만 접속
      </p>
    </>
  )
}
