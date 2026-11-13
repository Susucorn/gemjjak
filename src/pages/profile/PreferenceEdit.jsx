import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FullScreenStatus } from '../../components/routing/FullScreenStatus'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useLoader } from '../../hooks/useLoader'
import {
  fetchMyPreferences,
  fetchPreferenceOptions,
  preferenceErrorMessage,
  saveMyPreferences,
} from '../../services/preferencesService'
import { PreferenceStep } from '../onboarding/PreferenceStep'
import { PREFERENCE_STEPS, stepRequirement, toSavePayload } from '../onboarding/preferenceRules'
import { EditScreen } from './EditScreen'

/** /profile/edit/:section — section은 games | style | time */
export function PreferenceEdit() {
  const { section } = useParams()
  const { user } = useAuth()
  const step = PREFERENCE_STEPS.findIndex((item) => item.key === section)

  const load = useCallback(
    () =>
      Promise.all([fetchPreferenceOptions(), fetchMyPreferences(user.id)]).then(
        ([options, prefs]) => ({ options, prefs }),
      ),
    [user.id],
  )
  const loaded = useLoader(load)

  if (step === -1) return <Navigate to="/profile" replace />
  if (loaded.status === 'loading') return <FullScreenStatus>불러오는 중이에요</FullScreenStatus>
  if (loaded.status === 'error') {
    return (
      <FullScreenStatus>
        내 취향 정보를 불러오지 못했어요
        <Button onClick={loaded.reload}>다시 시도</Button>
      </FullScreenStatus>
    )
  }

  // 불러온 값으로 입력 상태를 처음 한 번만 만들기 위해 폼을 따로 그린다.
  return (
    <PreferenceEditForm step={step} options={loaded.data.options} initial={loaded.data.prefs} />
  )
}

/**
 * 한 항목만 고치는 화면이지만 저장은 게임·스타일·시간을 한꺼번에 한다.
 * 그래서 다른 항목이 비어 있으면(예: 장르 기능이 생기기 전에 가입해 장르가 없는 경우) 저장이 막힌다.
 * 그때는 무엇이 비었는지 알려 주고, 같은 화면에서 그 항목으로 바꿔 채우게 한다. 고친 내용은 그대로 남는다.
 */
function PreferenceEditForm({ step: initialStep, options, initial }) {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [step, setStep] = useState(initialStep)
  const [prefs, setPrefs] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const current = PREFERENCE_STEPS[step]

  const ownRequirement = stepRequirement(step, prefs, options.vocabulary)
  const missingStep = PREFERENCE_STEPS.findIndex(
    (_, index) => index !== step && stepRequirement(index, prefs, options.vocabulary),
  )
  const requirement =
    ownRequirement ??
    (missingStep === -1
      ? null
      : `${PREFERENCE_STEPS[missingStep].editTitle}이 비어 있어요. ${stepRequirement(
          missingStep,
          prefs,
          options.vocabulary,
        )}`)

  async function handleSubmit() {
    setIsSaving(true)
    setSaveError(null)
    try {
      await saveMyPreferences(toSavePayload(prefs, options.vocabulary))
      await refreshProfile()
      navigate('/profile', {
        state: { notice: `${PREFERENCE_STEPS[initialStep].editTitle}을 저장했어요` },
      })
    } catch (error) {
      setSaveError(preferenceErrorMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <EditScreen
      title={`${current.editTitle} 수정`}
      description={current.description}
      error={saveError}
      requirement={requirement}
      isSaving={isSaving}
      onSubmit={handleSubmit}
      extraAction={
        !ownRequirement &&
        missingStep !== -1 && (
          <Button
            variant="secondary"
            onClick={() => {
              setStep(missingStep)
              window.scrollTo(0, 0)
            }}
          >
            {PREFERENCE_STEPS[missingStep].editTitle} 채우기
          </Button>
        )
      }
    >
      <PreferenceStep step={step} options={options} prefs={prefs} onChange={setPrefs} />
    </EditScreen>
  )
}
