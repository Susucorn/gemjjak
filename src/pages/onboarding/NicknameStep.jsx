import { NICKNAME_MAX_LENGTH } from '../../services/profileService'
import formStyles from '../profile/ProfileForms.module.css'

/** 구글 가입자는 실명 대신 쓸 닉네임을 먼저 정한다. */
export function NicknameStep({ nickname, onChange, onSubmit }) {
  return (
    <form
      className={formStyles.form}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className={formStyles.field}>
        <span className={formStyles.label}>닉네임</span>
        <input
          className={formStyles.input}
          value={nickname}
          maxLength={NICKNAME_MAX_LENGTH}
          placeholder="예: 별빛여행자"
          autoComplete="nickname"
          enterKeyHint="next"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={formStyles.counter}>
          {nickname.length} / {NICKNAME_MAX_LENGTH}
        </span>
      </label>
    </form>
  )
}
