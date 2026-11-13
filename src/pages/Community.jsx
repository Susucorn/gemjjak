import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { supabase } from '../lib/supabaseClient'
import { fetchInviteInfo } from '../services/discordInvite'
import { normalize } from './onboarding/gameSearch'
import { fetchGames } from '../services/preferencesService'
import { fetchCommunityServers } from '../services/serverService'
import styles from './Community.module.css'

async function loadCommunity(userId) {
  const [servers, games, myGames] = await Promise.all([
    fetchCommunityServers(),
    fetchGames(),
    supabase.from('user_games').select('game_id').eq('user_id', userId),
  ])
  if (myGames.error) throw myGames.error
  return {
    servers,
    gameById: new Map(games.map((game) => [game.id, game])),
    myGameIds: new Set(myGames.data.map((row) => row.game_id)),
  }
}

/** /community — 게임별 디스코드 서버를 둘러보고 참여한다. */
export function Community() {
  const { user } = useAuth()
  const load = useCallback(() => loadCommunity(user.id), [user.id])
  const loaded = useLoader(load)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>커뮤니티</h1>
          <p className={styles.subtitle}>같은 게임을 하는 사람들이 모인 디스코드 서버예요</p>
        </div>
        <Link to="/profile/servers/new" className={styles.registerLink}>
          + 내 서버 등록
        </Link>
      </header>
      {loaded.status === 'loading' && (
        <p className={styles.status} role="status">
          서버 목록을 불러오는 중이에요
        </p>
      )}
      {loaded.status === 'error' && (
        <div className={styles.status}>
          <p>서버 목록을 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded.status === 'ready' && <ServerBrowser {...loaded.data} myId={user.id} />}
    </div>
  )
}

/**
 * 서버 이름·설명·게임 이름·게임 별명에서 찾는다. 띄어쓰기·대소문자는 무시한다.
 * 별명까지 보므로 '배그'로 배틀그라운드 서버를, '로아'로 로스트아크 서버를 찾는다.
 */
function matchesSearch(server, game, query) {
  const q = normalize(query)
  if (!q) return true
  const labels = [server.name, server.description ?? '']
  if (game) labels.push(game.name, ...(game.aliases ?? []))
  return labels.some((label) => normalize(label).includes(q))
}

function ServerBrowser({ servers, gameById, myGameIds, myId }) {
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)

  const approved = servers.filter((server) => server.status === 'approved')
  const myHidden = servers.filter(
    (server) => server.owner_id === myId && server.status !== 'approved',
  )
  const hasMine = approved.some((server) => myGameIds.has(server.game_id))

  const visible = approved
    .filter((server) => !onlyMine || myGameIds.has(server.game_id))
    .filter((server) => matchesSearch(server, gameById.get(server.game_id), query))
    // 내 게임 서버를 먼저, 그다음 사람이 많은 순
    .sort(
      (a, b) =>
        Number(myGameIds.has(b.game_id)) - Number(myGameIds.has(a.game_id)) ||
        b.member_count - a.member_count,
    )
  const searching = query.trim() !== '' || onlyMine

  return (
    <>
      {myHidden.length > 0 && (
        <p className={styles.notice}>
          내가 등록한 서버 {myHidden.length}개는 관리자가 숨겨서 공개되지 않아요.{' '}
          <Link to="/profile">프로필에서 보기</Link>
        </p>
      )}

      {approved.length > 0 && (
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <SearchIcon />
            <input
              type="search"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="게임이나 서버 이름으로 찾기 (예: 배그, 롤)"
              aria-label="서버 검색"
              enterKeyHint="search"
            />
          </div>
          {hasMine && (
            <Chip selected={onlyMine} onClick={() => setOnlyMine((prev) => !prev)}>
              내 게임만
            </Chip>
          )}
        </div>
      )}
      {searching && approved.length > 0 && (
        <p className={styles.resultCount} role="status">
          서버 {visible.length}개
        </p>
      )}

      {approved.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 공개된 서버가 없어요</p>
          <p>운영하는 디스코드 서버가 있다면 등록해 보세요.</p>
          <Link to="/profile/servers/new" className={styles.emptyLink}>
            서버 등록하기
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {query.trim() ? `‘${query.trim()}’ 서버를 찾지 못했어요` : '내 게임 서버가 없어요'}
          </p>
          <p>그 게임 서버를 운영하고 있다면 직접 등록해 보세요.</p>
          <Link to="/profile/servers/new" className={styles.emptyLink}>
            서버 등록하기
          </Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {visible.map((server) => (
            <li key={server.id}>
              <ServerCard
                server={server}
                gameName={gameById.get(server.game_id)?.name}
                isMyGame={myGameIds.has(server.game_id)}
                myId={myId}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function SearchIcon() {
  return (
    <svg
      className={styles.searchIcon}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4" />
    </svg>
  )
}

/** 디스코드에서 아이콘과 인원을 불러온다. 실패하면 DB에 저장된 값을 쓴다. */
function useInviteInfo(inviteUrl) {
  const [state, setState] = useState({ url: null, info: null })

  useEffect(() => {
    let cancelled = false
    fetchInviteInfo(inviteUrl)
      .then((info) => !cancelled && setState({ url: inviteUrl, info }))
      .catch(() => !cancelled && setState({ url: inviteUrl, info: null }))
    return () => {
      cancelled = true
    }
  }, [inviteUrl])

  return state.url === inviteUrl ? state.info : null
}

function formatCount(count) {
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}만`
  return count.toLocaleString()
}

function ServerCard({ server, gameName, isMyGame, myId }) {
  const info = useInviteInfo(server.invite_url)
  const expired = info?.valid === false
  const members = info?.members ?? (server.member_count || null)
  const online = info?.online ?? (server.online_count || null)

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        {info?.iconUrl ? (
          <img className={styles.icon} src={info.iconUrl} alt="" width="48" height="48" />
        ) : (
          <span className={`${styles.icon} ${styles.iconFallback}`} aria-hidden="true">
            <DiscordIcon size={24} />
          </span>
        )}
        <div className={styles.cardTitle}>
          <h2 className={styles.name}>{server.name}</h2>
          <p className={styles.meta}>
            {gameName && (
              <span className={isMyGame ? styles.gameMine : styles.game}>{gameName}</span>
            )}
            {server.owner ? (
              server.owner_id === myId ? (
                <span>내가 등록</span>
              ) : (
                <Link to={`/users/${server.owner_id}`} className={styles.owner}>
                  {server.owner.nickname}님 운영
                </Link>
              )
            ) : (
              <span>겜짝 추천</span>
            )}
          </p>
        </div>
      </div>

      {server.description && <p className={styles.description}>{server.description}</p>}

      <div className={styles.cardBottom}>
        <p className={styles.counts}>
          {expired ? (
            <span className={styles.expired}>초대 링크가 만료됐어요</span>
          ) : (
            <>
              {members != null && <span>멤버 {formatCount(members)}</span>}
              {online != null && (
                <span className={styles.online}>
                  <span className={styles.onlineDot} aria-hidden="true" />
                  접속 {formatCount(online)}
                </span>
              )}
            </>
          )}
        </p>
        {expired ? (
          <span className={`${styles.join} ${styles.joinDisabled}`}>참여 불가</span>
        ) : (
          <a
            href={server.invite_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.join}
            aria-label={`${server.name} 디스코드 서버 참여하기 (새 창)`}
          >
            참여하기
          </a>
        )}
      </div>
    </article>
  )
}
