import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MatchCard } from '../components/match/MatchCard'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { rankPlayers } from '../lib/compatibility'
import { fetchPlayers } from '../services/matchService'
import styles from './Home.module.css'

export function Home() {
  const { user, profile } = useAuth()
  const load = useCallback(() => fetchPlayers(user.id), [user.id])
  const loaded = useLoader(load)

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.greeting}>{profile?.nickname}님,</p>
        <h1 className={styles.title}>오늘 잘 맞는 게이머를 찾았어요</h1>
      </header>

      {loaded.status === 'loading' && (
        <p className={styles.status} role="status">
          궁합을 계산하는 중이에요
        </p>
      )}
      {loaded.status === 'error' && (
        <div className={styles.status}>
          <p>추천 목록을 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded.status === 'ready' && <Recommendations {...loaded.data} />}
    </div>
  )
}

function Recommendations({ me, others }) {
  if (!me) {
    return (
      <p className={styles.status}>
        내 취향 정보를 찾지 못했어요. <Link to="/profile">프로필</Link>에서 확인해 주세요.
      </p>
    )
  }

  const { today, similar } = rankPlayers(me, others)
  const myGames = [...me.games.values()]

  return (
    <>
      <section className={styles.summary} aria-label="내 취향 요약">
        <div className={styles.summaryText}>
          <p className={styles.summaryLabel}>내 취향</p>
          <p className={styles.summaryGames}>
            {myGames.slice(0, 3).join(' · ')}
            {myGames.length > 3 && ` 외 ${myGames.length - 3}개`}
          </p>
          <p className={styles.summaryMeta}>
            취향 태그 {me.tags.size}개 · 주 {me.hours.size}시간 접속
          </p>
        </div>
        <Link to="/profile" className={styles.summaryLink}>
          수정
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="today-title">
        <div className={styles.sectionHeader}>
          <h2 id="today-title" className={styles.sectionTitle}>
            오늘의 추천 게이머
          </h2>
          <p className={styles.sectionHint}>공통 게임 · 접속 시간 · 스타일로 계산했어요</p>
        </div>
        {today.length === 0 ? (
          <p className={styles.empty}>
            아직 나와 겹치는 게이머가 없어요. 게임이나 접속 시간을 더 넣으면 추천이 늘어나요.
          </p>
        ) : (
          <ul className={styles.carousel}>
            {today.map(({ player, match }) => (
              <li key={player.id} className={styles.carouselItem}>
                <MatchCard player={player} match={match} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {similar.length > 0 && (
        <section className={styles.section} aria-labelledby="similar-title">
          <div className={styles.sectionHeader}>
            <h2 id="similar-title" className={styles.sectionTitle}>
              나와 유사한 플레이어
            </h2>
            <p className={styles.sectionHint}>플레이 스타일과 장르가 비슷해요</p>
          </div>
          <ul className={styles.grid}>
            {similar.map(({ player, match }) => (
              <li key={player.id}>
                <MatchCard player={player} match={match} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
