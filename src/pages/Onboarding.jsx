import { useCallback, useEffect, useRef, useState } from 'react'
import { FullScreenStatus } from '../components/routing/FullScreenStatus'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/authService'
import {
  fetchGames,
  fetchGenres,
  fetchTagVocabulary,
  saveMyPreferences,
} from '../services/preferencesService'
import { GameStep } from './onboarding/GameStep'
import { TagStep } from './onboarding/TagStep'
import { TimeStep } from './onboarding/TimeStep'
import styles from './onboarding/Onboarding.module.css'

const STEPS = [
  {
    title: '어떤 게임을 하세요?',
    description: '하는 게임을 모두 골라 주세요. 목록에 없으면 검색해서 추가를 요청할 수 있어요.',
  },
  {
    title: '어떻게 플레이하세요?',
    description: '장르와 플레이 스타일이 맞는 사람일수록 궁합 점수가 높아져요.',
  },
  {
    title: '주로 언제 접속하세요?',
    description: '평일과 주말을 나눠 골라 주세요. 접속 시간이 겹치는 사람을 추천해요.',
  },
]

function toggleInSet(set, value) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function Onboarding() {
  const { profile, refreshProfile } = useAuth()
  const [data, setData] = useState({ status: 'loading', games: [], genres: [], vocabulary: [] })
  const [step, setStep] = useState(0)
  const [gameIds, setGameIds] = useState(() => new Set())
  const [requestedGames, setRequestedGames] = useState([])
  const [genreIds, setGenreIds] = useState(() => new Set())
  const [tags, setTags] = useState(() => new Set())
  const [hours, setHours] = useState(() => ({ weekday: new Set(), weekend: new Set() }))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const headingRef = useRef(null)
  const isFirstRender = useRef(true)

  // 첫 화면은 이미 loading 상태로 시작하므로 effect 안에서 상태를 바꾸지 않고 결과만 반영한다.
  // 화면을 벗어난 뒤 늦게 도착한 응답은 버린다.
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let isStale = false
    Promise.all([fetchGames(), fetchGenres(), fetchTagVocabulary()]).then(
      ([games, genres, vocabulary]) => {
        if (!isStale) setData({ status: 'ready', games, genres, vocabulary })
      },
      () => {
        if (!isStale) setData((prev) => ({ ...prev, status: 'error' }))
      },
    )
    return () => {
      isStale = true
    }
  }, [loadKey])

  const reload = useCallback(() => {
    setData((prev) => ({ ...prev, status: 'loading' }))
    setLoadKey((key) => key + 1)
  }, [])

  // 단계가 바뀌면 화면 맨 위로 올리고, 스크린 리더가 새 질문을 읽도록 제목에 초점을 준다.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    headingRef.current?.focus()
  }, [step])

  if (data.status === 'loading') return <FullScreenStatus>불러오는 중이에요</FullScreenStatus>
  if (data.status === 'error') {
    return (
      <FullScreenStatus>
        게임 목록을 불러오지 못했어요
        <Button onClick={reload}>다시 시도</Button>
      </FullScreenStatus>
    )
  }

  const hasStyleTag = data.vocabulary.some(
    (item) => item.category === 'style' && tags.has(item.tag),
  )
  // 단계별로 아직 채우지 않은 필수 항목 안내. null이면 다음으로 갈 수 있다.
  const requirement = [
    gameIds.size + requestedGames.length === 0
      ? '게임을 1개 이상 고르거나 추가 요청해 주세요'
      : null,
    genreIds.size === 0
      ? '좋아하는 장르를 1개 이상 골라 주세요'
      : !hasStyleTag
        ? '플레이 스타일을 1개 이상 골라 주세요'
        : null,
    hours.weekday.size + hours.weekend.size === 0 ? '접속 시간을 1칸 이상 골라 주세요' : null,
  ][step]
  const isStepValid = requirement === null
  const isLastStep = step === STEPS.length - 1
  const current = STEPS[step]
  const genreNameById = new Map(data.genres.map((genre) => [genre.id, genre.name]))

  async function handleSubmit() {
    // 게임 선택을 바꾸면 빠진 게임의 콘텐츠 태그가 남아 있을 수 있어 저장 직전에 걸러 낸다.
    const validTags = data.vocabulary
      .filter((item) => item.category !== 'activity' || gameIds.has(item.game_id))
      .map((item) => item.tag)
    const savedTags = [...tags].filter((tag) => validTags.includes(tag))

    setIsSaving(true)
    setSaveError(null)
    try {
      await saveMyPreferences({
        gameIds: [...gameIds],
        requestedGames,
        genreIds: [...genreIds],
        tags: savedTags,
        weekdayHours: [...hours.weekday],
        weekendHours: [...hours.weekend],
      })
      // onboarded가 true로 바뀌면 라우트 가드가 홈으로 보낸다.
      await refreshProfile()
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  function handleNext() {
    if (isLastStep) {
      handleSubmit()
      return
    }
    // 장르를 아직 안 골랐다면 고른 게임의 장르를 미리 선택해 둔다. 사용자가 바로 고칠 수 있다.
    if (step === 0 && genreIds.size === 0) {
      const gameGenres = data.games
        .filter((game) => gameIds.has(game.id) && game.genre_id)
        .map((game) => game.genre_id)
      setGenreIds(new Set(gameGenres))
    }
    setStep(step + 1)
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          {step > 0 ? (
            <button
              type="button"
              className={styles.backButton}
              onClick={() => setStep(step - 1)}
              disabled={isSaving}
              aria-label="이전 단계"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 5l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => signOut().catch(() => {})}
            >
              로그아웃
            </button>
          )}
          <p className={styles.stepCount}>
            {step + 1} / {STEPS.length}
          </p>
        </header>

        <div
          className={styles.progress}
          role="progressbar"
          aria-label="온보딩 진행률"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <span
            className={styles.progressFill}
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <section className={styles.intro}>
          {step === 0 && profile?.nickname && (
            <p className={styles.greeting}>{profile.nickname}님, 반가워요!</p>
          )}
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {current.title}
          </h1>
          <p className={styles.description}>{current.description}</p>
        </section>

        <div className={styles.body}>
          {step === 0 && (
            <GameStep
              games={data.games}
              genreNameById={genreNameById}
              selectedIds={gameIds}
              requestedGames={requestedGames}
              onToggle={(id) => setGameIds((prev) => toggleInSet(prev, id))}
              onRequest={(name) => setRequestedGames((prev) => [...prev, name])}
              onRemoveRequest={(name) =>
                setRequestedGames((prev) => prev.filter((item) => item !== name))
              }
            />
          )}
          {step === 1 && (
            <TagStep
              genres={data.genres}
              selectedGenreIds={genreIds}
              onToggleGenre={(id) => setGenreIds((prev) => toggleInSet(prev, id))}
              vocabulary={data.vocabulary}
              selectedGameIds={gameIds}
              selectedTags={tags}
              onToggleTag={(tag) => setTags((prev) => toggleInSet(prev, tag))}
            />
          )}
          {step === 2 && (
            <TimeStep
              hours={hours}
              onToggleHour={(dayType, hour) =>
                setHours((prev) => ({ ...prev, [dayType]: toggleInSet(prev[dayType], hour) }))
              }
              onSetHours={(dayType, next) => setHours((prev) => ({ ...prev, [dayType]: next }))}
            />
          )}
        </div>

        <footer className={styles.footer}>
          {saveError && (
            <p className={styles.alert} role="alert">
              {saveError}
            </p>
          )}
          {requirement && <p className={styles.requirement}>{requirement}</p>}
          <Button
            className={styles.nextButton}
            onClick={handleNext}
            disabled={!isStepValid || isSaving}
            aria-busy={isSaving}
          >
            {isLastStep ? (isSaving ? '저장 중…' : '겜짝 시작하기') : '다음'}
          </Button>
        </footer>
      </div>
    </main>
  )
}
