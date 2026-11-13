import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { GoogleIcon } from '../components/ui/GoogleIcon'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { saveReturnTo } from '../lib/returnTo'
import { signInWithProvider } from '../services/authService'
import {
  AiVisual,
  ChatVisual,
  CommunityVisual,
  MatchVisual,
  ProfileVisual,
  RecommendVisual,
  ScoreVisual,
} from './landing/Visuals'
import styles from './landing/Landing.module.css'

// 첫 화면은 겜짝이 무엇을 해 주는지 스크롤하며 차례로 보여 주는 소개 페이지다.
// 로그인 버튼은 맨 위(히어로)와 맨 아래(07 시작하기)에 있고, 상단 헤더의 [시작하기]는 맨 아래로 이동한다.
const FEATURES = [
  {
    id: 'score',
    short: '궁합 점수',
    eyebrow: 'MATCH SCORE · 궁합 점수',
    title: ['게임 이름만 맞추는 구인은 그만,', '시간과 성향까지 한 점수로'],
    body: '같이 하는 게임, 접속 시간이 겹치는 정도, 플레이 스타일을 합쳐 궁합 점수(%)를 계산해요. 게임이 달라도 장르가 같으면 점수를 더해 줘요.',
    points: ['공통 게임 40%', '접속 시간 겹침 35%', '플레이 스타일 25%'],
    Visual: ScoreVisual,
  },
  {
    id: 'profile',
    short: '취향 프로필',
    eyebrow: 'PROFILE · 취향 프로필',
    title: ['목록에 없는 게임도,', '요일마다 다른 시간도'],
    body: '인기 게임을 고르고, 없는 게임·장르·스타일은 직접 입력하면 바로 반영돼요. 접속 시간은 월요일부터 일요일까지 요일마다 따로 정할 수 있어요.',
    points: ['게임·장르·스타일 직접 추가', '요일별 24칸 접속 시간', '언제든 프로필에서 수정'],
    Visual: ProfileVisual,
  },
  {
    id: 'recommend',
    short: '오늘의 추천',
    eyebrow: 'RECOMMEND · 오늘의 추천',
    title: ['왜 잘 맞는지', '이유까지 알려 줘요'],
    body: '홈에서 궁합 높은 게이머를 카드로 보여 줘요. "공통 게임 원신 · 밤 9시 이후 시간이 겹쳐요"처럼 추천한 이유를 함께 보여 줘서 믿고 먼저 말을 걸 수 있어요.',
    points: ['궁합 % 게이지', '공통 태그 강조', '나와 유사한 플레이어'],
    Visual: RecommendVisual,
  },
  {
    id: 'chat',
    short: '1:1 채팅',
    eyebrow: 'CHAT · 1:1 채팅',
    title: ['추천 카드에서', '바로 말 걸기'],
    body: '마음에 드는 게이머에게 [채팅하기]를 누르면 바로 대화가 시작돼요. 대화방 위에 궁합과 공통점이 보이고, 빠른 답장 칩으로 첫 메시지 부담을 줄였어요.',
    points: ['실시간 채팅', '매칭 근거 고정 표시', '빠른 답장 칩'],
    Visual: ChatVisual,
  },
  {
    id: 'community',
    short: '디스코드 커뮤니티',
    eyebrow: 'COMMUNITY · 디스코드 커뮤니티',
    title: ['흩어진 디스코드 서버를', '한곳에서 찾고 참여해요'],
    body: '게임별 디스코드 서버를 멤버 수·온라인 수와 함께 보여 주고, [참여]를 누르면 디스코드로 바로 이동해요. 운영하는 서버가 있다면 프로필에서 등록할 수 있어요.',
    points: ['게임별 서버 필터', '멤버·온라인 수', '내 서버 등록'],
    Visual: CommunityVisual,
  },
  {
    id: 'ai',
    short: 'AI 도우미',
    eyebrow: 'AI HELPER · AI 도우미',
    title: ['필터 대신', '말로 물어보세요'],
    body: '"주말 오후에 원신 같이 할 뉴비환영 유저 있어?"처럼 물으면 AI가 내 프로필과 지금 시각을 반영해 조건을 만들고, 실제 사용자 중에서 궁합순으로 찾아 줘요.',
    points: ['"지금", "주말 저녁"도 이해', '내 프로필 반영', '실제 사용자만 추천'],
    Visual: AiVisual,
  },
]

const INDEX = [
  ...FEATURES.map((feature) => ({ id: feature.id, short: feature.short })),
  { id: 'start', short: '시작하기' },
]

/** 고정 헤더(56px) + 목차 바(52px) 아래쪽 기준선. 섹션 위쪽이 이 선을 지나면 그 섹션을 보고 있는 것으로 본다. */
const ACTIVE_LINE = 140

/** 지금 보고 있는 섹션 id. 아직 히어로를 보고 있으면 null이다. */
function useActiveSection(ids) {
  const [activeId, setActiveId] = useState(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current = null
      for (const id of ids) {
        const section = document.getElementById(id)
        if (section && section.getBoundingClientRect().top <= ACTIVE_LINE) current = id
      }
      // 맨 아래까지 내리면 마지막 섹션(시작하기)이 기준선에 닿지 않아도 그 섹션으로 본다.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActiveId(atBottom ? ids.at(-1) : current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids])

  return activeId
}

const INDEX_IDS = INDEX.map((item) => item.id)

/** 화면 위쪽에 고정되는 목차. 모바일에서 현재 항목이 가려져 있으면 옆으로 밀어서 보여 준다. */
function IndexNav() {
  const activeId = useActiveSection(INDEX_IDS)
  const listRef = useRef(null)

  useEffect(() => {
    const list = listRef.current
    const active = list?.querySelector('[aria-current="location"]')
    if (!list || !active) return
    // scrollIntoView는 페이지 세로 스크롤까지 움직일 수 있어 목차 가로 스크롤만 직접 옮긴다.
    const left = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [activeId])

  return (
    <nav className={styles.index} aria-label="소개 목차">
      <ol ref={listRef}>
        {INDEX.map((item, number) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={activeId === item.id ? styles.indexActive : undefined}
              aria-current={activeId === item.id ? 'location' : undefined}
            >
              <span className={styles.indexNumber}>{String(number + 1).padStart(2, '0')}</span>
              {item.short}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** 화면에 들어오면 한 번 살짝 떠오르며 나타난다. 움직임 줄이기 설정에서는 CSS가 효과를 끈다. */
function Reveal({ children, className = '' }) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (isVisible) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [isVisible])

  return (
    <div ref={ref} className={`${styles.reveal} ${isVisible ? styles.revealed : ''} ${className}`}>
      {children}
    </div>
  )
}

function AuthButtons({ redirectingTo, onLogin }) {
  const disabled = !isSupabaseConfigured || redirectingTo !== null
  return (
    <div className={styles.authButtons}>
      <button
        type="button"
        className={styles.discordButton}
        onClick={() => onLogin('discord')}
        disabled={disabled}
        aria-busy={redirectingTo === 'discord'}
      >
        <DiscordIcon />
        {redirectingTo === 'discord' ? '디스코드로 이동 중…' : '디스코드로 시작하기'}
      </button>
      <button
        type="button"
        className={styles.googleButton}
        onClick={() => onLogin('google')}
        disabled={disabled}
        aria-busy={redirectingTo === 'google'}
      >
        <GoogleIcon />
        {redirectingTo === 'google' ? '구글로 이동 중…' : '구글로 시작하기'}
      </button>
    </div>
  )
}

/**
 * 디스코드·구글에서 취소하거나 실패하면 Supabase가 ?error=...를 붙여 /login으로 돌려보낸다.
 * 흐름에 따라 쿼리 대신 #해시에 붙기도 해서 둘 다 확인한다.
 */
function readOAuthError() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const code = search.get('error') ?? hash.get('error')
  if (!code) return null
  if (code === 'access_denied') return '로그인을 취소했어요. 다시 시도해 주세요.'
  return '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function Login() {
  const location = useLocation()
  const [error, setError] = useState(readOAuthError)
  // 이동 중인 로그인 방법. null이면 버튼을 누를 수 있다.
  const [redirectingTo, setRedirectingTo] = useState(null)

  // 오류 파라미터가 주소창에 남아 있으면 새로고침할 때마다 같은 오류가 다시 뜬다.
  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname)
    }
  }, [])

  // 디스코드·구글 화면에서 뒤로 가기로 돌아오면 브라우저가 이전 화면을 그대로 복원해
  // 버튼이 "이동 중" 상태로 멈춰 있게 된다.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (event.persisted) setRedirectingTo(null)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function handleLogin(provider) {
    const from = location.state?.from
    if (from) saveReturnTo(`${from.pathname}${from.search ?? ''}${from.hash ?? ''}`)

    setError(null)
    setRedirectingTo(provider)
    try {
      await signInWithProvider(provider)
    } catch {
      setError('로그인 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.')
      setRedirectingTo(null)
    }
  }

  const alerts = (
    <>
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
    </>
  )

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <a href="#top" className={styles.logo}>
          겜짝
        </a>
        <a href="#start" className={styles.topCta}>
          시작하기
        </a>
      </header>

      <main>
        <section id="top" className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.heroEyebrow}>게임 짝꿍 매칭</p>
            <h1 className={styles.heroTitle}>
              나랑 잘 맞는
              <br />
              <mark className={styles.highlight}>게임 짝꿍</mark> 찾기
            </h1>
            <p className={styles.heroLead}>
              하는 게임, 접속 시간, 플레이 스타일로 궁합을 계산해 나와 맞는 게이머와 디스코드
              커뮤니티를 찾아 드려요.
            </p>
            {alerts}
            <AuthButtons redirectingTo={redirectingTo} onLogin={handleLogin} />
            <p className={styles.note}>닉네임과 프로필 사진만 가져와요. 계정에 글을 쓰지 않아요.</p>
          </div>
          <div className={styles.heroVisual}>
            <MatchVisual />
          </div>
        </section>

        <IndexNav />

        {FEATURES.map((feature, number) => (
          <section
            key={feature.id}
            id={feature.id}
            className={`${styles.feature} ${number % 2 === 1 ? styles.featureReverse : ''}`}
            aria-labelledby={`${feature.id}-title`}
          >
            <Reveal className={styles.featureText}>
              <p className={styles.eyebrow}>{feature.eyebrow}</p>
              <div className={styles.featureHeading}>
                <span className={styles.bigNumber} aria-hidden="true">
                  {String(number + 1).padStart(2, '0')}
                </span>
                <h2 id={`${feature.id}-title`} className={styles.featureTitle}>
                  <span className={styles.titleMark}>
                    {feature.title[0]}
                    <br />
                    {feature.title[1]}
                  </span>
                </h2>
              </div>
              <p className={styles.featureBody}>{feature.body}</p>
              <ul className={styles.points}>
                {feature.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal className={styles.featureVisual}>
              <feature.Visual />
            </Reveal>
          </section>
        ))}

        <section id="start" className={styles.start} aria-labelledby="start-title">
          <Reveal className={styles.startInner}>
            <p className={styles.eyebrow}>START · 시작하기</p>
            <h2 id="start-title" className={styles.startTitle}>
              3분이면 내 게임 짝꿍을
              <br />
              만날 수 있어요
            </h2>
            <ol className={styles.steps}>
              <li>디스코드나 구글로 로그인</li>
              <li>하는 게임·스타일·접속 시간 고르기</li>
              <li>궁합 높은 게이머에게 말 걸기</li>
            </ol>
            {alerts}
            <AuthButtons redirectingTo={redirectingTo} onLogin={handleLogin} />
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>겜짝 · 게임 취향 기반 게이머·디스코드 커뮤니티 추천</footer>
    </div>
  )
}
