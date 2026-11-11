import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { FullScreenStatus } from '../../components/routing/FullScreenStatus'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useLoader } from '../../hooks/useLoader'
import {
  fetchMyPreferences,
  fetchPreferenceOptions,
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

function PreferenceEditForm({ step, options, initial }) {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const [prefs, setPrefs] = useState(initial)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const current = PREFERENCE_STEPS[step]

  async function handleSubmit() {
    setIsSaving(true)
    setSaveError(null)
    try {
      await saveMyPreferences(toSavePayload(prefs, options.vocabulary))
      await refreshProfile()
      navigate('/profile', { state: { notice: `${current.editTitle}을 저장했어요` } })
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  return (
    <EditScreen
      title={`${current.editTitle} 수정`}
      description={current.description}
      error={saveError}
      requirement={stepRequirement(step, prefs, options.vocabulary)}
      isSaving={isSaving}
      onSubmit={handleSubmit}
    >
      <PreferenceStep step={step} options={options} prefs={prefs} onChange={setPrefs} />
    </EditScreen>
  )
}
