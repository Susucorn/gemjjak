import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { useAuth } from '../../hooks/useAuth'
import { isDiscordUser } from '../../services/authService'
import {
  BIO_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  updateProfileInfo,
} from '../../services/profileService'
import { EditScreen } from './EditScreen'
import styles from './ProfileForms.module.css'

/** /profile/edit/info — 닉네임과 소개 */
export function ProfileInfoEdit() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState(profile.nickname ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const requirement = nickname.trim() === '' ? '닉네임을 입력해 주세요' : null

  async function handleSubmit() {
    setIsSaving(true)
    setSaveError(null)
    try {
      await updateProfileInfo(user.id, { nickname, bio })
      await refreshProfile()
      navigate('/profile', { state: { notice: '프로필을 저장했어요' } })
    } catch {
      setSaveError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setIsSaving(false)
    }
  }

  return (
    <EditScreen
      title="프로필 수정"
      description="다른 게이머에게 보이는 이름과 소개예요."
      error={saveError}
      requirement={requirement}
      isSaving={isSaving}
      onSubmit={handleSubmit}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!requirement && !isSaving) handleSubmit()
        }}
      >
        <div className={styles.avatarRow}>
          <Avatar src={profile.avatar_url} name={nickname || profile.nickname} size={64} />
          <p className={styles.help}>
            {isDiscordUser(user)
              ? '프로필 사진은 디스코드 프로필 사진을 써요.'
              : '구글 사진은 가져오지 않고 닉네임 첫 글자를 보여 줘요.'}
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            닉네임 <span className={styles.required}>필수</span>
          </span>
          <input
            className={styles.input}
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="nickname"
            required
          />
          <span className={styles.counter}>
            {nickname.length} / {NICKNAME_MAX_LENGTH}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>소개</span>
          <textarea
            className={styles.textarea}
            value={bio}
            maxLength={BIO_MAX_LENGTH}
            rows={4}
            placeholder="예: 평일 밤에 롤 듀오 구해요. 즐겜러라 편하게 하실 분 환영!"
            onChange={(event) => setBio(event.target.value)}
          />
          <span className={styles.counter}>
            {bio.length} / {BIO_MAX_LENGTH}
          </span>
        </label>
      </form>
    </EditScreen>
  )
}
