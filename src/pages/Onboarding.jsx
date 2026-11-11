import { useEffect, useRef, useState } from 'react'
import { FullScreenStatus } from '../components/routing/FullScreenStatus'
import { BackIcon } from '../components/ui/BackIcon'
import { Button } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { isDiscordUser, signOut } from '../services/authService'
import { fetchPreferenceOptions, saveMyPreferences } from '../services/preferencesService'
import { updateNickname } from '../services/profileService'
import { NicknameStep } from './onboarding/NicknameStep'
import { PreferenceStep } from './onboarding/PreferenceStep'
import {
  PREFERENCE_STEPS,
  emptyPreferences,
  genresOfGames,
  stepRequirement,
  toSavePayload,
} from './onboarding/preferenceRules'
import styles from './onboarding/Onboarding.module.css'

const NICKNAME_STEP = {
  key: 'nickname',
  title: '겜짝에서 쓸 닉네임을 정해 주세요',
  description: '다른 게이머에게 보이는 이름이에요. 실명이 아니어도 돼요.',
}

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const options = useLoader(fetchPreferenceOptions)
  // 디스코드 가입자는 디스코드 이름을 쓰고, 구글 가입자는 실명 대신 닉네임을 먼저 정한다.
  const needsNickname = !isDiscordUser(user)
  const steps = needsNickname ? [NICKNAME_STEP, ...PREFERENCE_STEPS] : PREFERENCE_STEPS
  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState('')
  const [prefs, setPrefs] = useState(emptyPreferences)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const headingRef = useRef(null)
  const isFirstRender = useRef(true)

  // 단계가 바뀌면 화면 맨 위로 올리고, 스크린 리더가 새 질문을 읽도록 제목에 초점을 준다.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    headingRef.current?.focus()
  }, [step])

  if (options.status === 'loading') return <FullScreenStatus>불러오는 중이에요</FullScreenStatus>
  if (options.status === 'error') {
    return (
      <FullScreenStatus>
        게임 목록을 불러오지 못했어요
        <Button onClick={options.reload}>다시 시도</Button>
      </FullScreenStatus>
    )
  }

  const current = steps[step]
  // 취향 단계 번호(0 게임, 1 스타일, 2 시간). 닉네임 단계면 -1
  const preferenceStep = step - (needsNickname ? 1 : 0)
  const isNicknameStep = current.key === 'nickname'
  const requirement = isNicknameStep
    ? nickname.trim() === ''
      ? '닉네임을 입력해 주세요'
      : null
    : stepRequirement(preferenceStep, prefs, options.data.vocabulary)
  const isLastStep = step === steps.length - 1
  const greetingName = needsNickname ? nickname.trim() : profile?.nickname

  async function handleSubmit() {
    setIsSaving(true)
    setSaveError(null)
    try {
      if (needsNickname) await updateNickname(user.id, nickname)
      await saveMyPreferences(toSavePayload(prefs, options.data.vocabulary))
      // onboarded가 true로 바뀌면 라우트 가드가 홈으로 보낸다.
      await refreshProfile()
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  function handleNext() {
    if (requirement !== null || isSaving) return
    if (isLastStep) {
      handleSubmit()
      return
    }
    // 장르를 아직 안 골랐다면 고른 게임의 장르를 미리 선택해 둔다. 사용자가 바로 고칠 수 있다.
    if (preferenceStep === 0 && prefs.genreIds.size === 0) {
      setPrefs((prev) => ({ ...prev, genreIds: genresOfGames(options.data.games, prev.gameIds) }))
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
              <BackIcon />
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
            {step + 1} / {steps.length}
          </p>
        </header>

        <div
          className={styles.progress}
          role="progressbar"
          aria-label="온보딩 진행률"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
        >
          <span
            className={styles.progressFill}
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <section className={styles.intro}>
          {preferenceStep === 0 && greetingName && (
            <p className={styles.greeting}>{greetingName}님, 반가워요!</p>
          )}
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            {current.title}
          </h1>
          <p className={styles.description}>{current.description}</p>
        </section>

        <div className={styles.body}>
          {isNicknameStep ? (
            <NicknameStep nickname={nickname} onChange={setNickname} onSubmit={handleNext} />
          ) : (
            <PreferenceStep
              step={preferenceStep}
              options={options.data}
              prefs={prefs}
              onChange={setPrefs}
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
            disabled={requirement !== null || isSaving}
            aria-busy={isSaving}
          >
            {isLastStep ? (isSaving ? '저장 중…' : '겜짝 시작하기') : '다음'}
          </Button>
        </footer>
      </div>
    </main>
  )
}
