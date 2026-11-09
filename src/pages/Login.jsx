import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { saveReturnTo } from '../lib/returnTo'
import { signInWithDiscord } from '../services/authService'
import styles from './Login.module.css'

const SAMPLE_TAGS = ['즐겜', '보이스OK', '뉴비환영']
const SAMPLE_SCORE = 95

/**
 * 디스코드에서 취소하거나 실패하면 Supabase가 ?error=...를 붙여 /login으로 돌려보낸다.
 * 흐름에 따라 쿼리 대신 #해시에 붙기도 해서 둘 다 확인한다.
 */
function readOAuthError() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const code = search.get('error') ?? hash.get('error')
  if (!code) return null
  if (code === 'access_denied') return '디스코드 로그인을 취소했어요. 다시 시도해 주세요.'
  return '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function Login() {
  const location = useLocation()
  const [error, setError] = useState(readOAuthError)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // 오류 파라미터가 주소창에 남아 있으면 새로고침할 때마다 같은 오류가 다시 뜬다.
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  // 디스코드 화면에서 뒤로 가기로 돌아오면 브라우저가 이전 화면을 그대로 복원해
  // 버튼이 "이동 중" 상태로 멈춰 있게 된다.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) setIsRedirecting(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleLogin() {
    const from = location.state?.from
    if (from) saveReturnTo(`${from.pathname}${from.search ?? ''}${from.hash ?? ''}`)

    setError(null)
    setIsRedirecting(true)
    try {
      await signInWithDiscord()
    } catch {
      setError('디스코드 로그인 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsRedirecting(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <section className={styles.hero}>
          <p className={styles.logo}>겜짝</p>
          <h1 className={styles.title}>
            나랑 잘 맞는
            <br />
            게임 짝꿍 찾기
          </h1>
          <p className={styles.lead}>
            하는 게임, 접속 시간, 플레이 스타일로
            <br />
            궁합 점수를 계산해 드려요.
          </p>
        </section>

        <figure className={styles.preview} aria-label="추천 카드 예시">
          <div className={styles.previewHeader}>
            <Avatar name="별빛여행자" size={48} />
            <div className={styles.previewName}>
              <p className={styles.nickname}>별빛여행자</p>
              <p className={styles.games}>원신 · 붕괴: 스타레일</p>
            </div>
            <p className={styles.score}>
              <span className={styles.scoreLabel}>궁합</span>
              {SAMPLE_SCORE}%
            </p>
          </div>
          <div
            className={styles.gauge}
            role="meter"
            aria-label="궁합 점수"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={SAMPLE_SCORE}
          >
            <span className={styles.gaugeFill} style={{ width: `${SAMPLE_SCORE}%` }} />
          </div>
          <ul className={styles.tags} aria-label="플레이 스타일">
            {SAMPLE_TAGS.map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
          <figcaption className={styles.reason}>
            공통 게임 원신 · 밤 9시 이후 시간이 겹쳐요
          </figcaption>
        </figure>

        <div className={styles.actions}>
          {!isSupabaseConfigured && (
            <p className={styles.alert} role="alert">
              Supabase 환경 변수가 없어요. .env.example을 복사해 .env를 만들고 값을 채워 주세요.
            </p>
          )}
          {error && (
            <p className={styles.alert} role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            className={styles.discordButton}
            onClick={handleLogin}
            disabled={!isSupabaseConfigured || isRedirecting}
            aria-busy={isRedirecting}
          >
            <DiscordIcon />
            {isRedirecting ? '디스코드로 이동 중…' : '디스코드로 시작하기'}
          </button>

          <p className={styles.note}>
            디스코드 닉네임과 프로필 사진만 가져와요.
            <br />
            디스코드 계정에 글을 쓰거나 서버에 참여하지 않아요.
          </p>
        </div>
      </div>
    </main>
  )
}
