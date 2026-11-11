import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FullScreenStatus } from '../../components/routing/FullScreenStatus'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useLoader } from '../../hooks/useLoader'
import { fetchGames } from '../../services/preferencesService'
import {
  SERVER_DESCRIPTION_MAX_LENGTH,
  SERVER_NAME_MAX_LENGTH,
  SERVER_STATUS_LABEL,
  createServer,
  deleteServer,
  fetchMyServer,
  normalizeInviteUrl,
  serverErrorMessage,
  updateServer,
} from '../../services/serverService'
import { EditScreen } from './EditScreen'
import styles from './ProfileForms.module.css'

/** /profile/servers/new, /profile/servers/:serverId */
export function ServerForm() {
  const { serverId } = useParams()
  const { user } = useAuth()

  const load = useCallback(
    () =>
      Promise.all([fetchGames(), serverId ? fetchMyServer(user.id, serverId) : null]).then(
        ([games, server]) => ({ games, server }),
      ),
    [user.id, serverId],
  )
  const loaded = useLoader(load)

  if (loaded.status === 'loading') return <FullScreenStatus>불러오는 중이에요</FullScreenStatus>
  if (loaded.status === 'error') {
    return (
      <FullScreenStatus>
        서버 정보를 불러오지 못했어요
        <Button onClick={loaded.reload}>다시 시도</Button>
      </FullScreenStatus>
    )
  }
  if (serverId && !loaded.data.server) {
    return (
      <EditScreen title="서버를 찾을 수 없어요" description="이미 삭제했거나 내 서버가 아니에요." />
    )
  }

  return (
    <ServerFormFields
      key={serverId ?? 'new'}
      games={loaded.data.games}
      server={loaded.data.server}
    />
  )
}

function ServerFormFields({ games, server }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState(server?.name ?? '')
  const [gameId, setGameId] = useState(server?.game_id ?? null)
  const [inviteInput, setInviteInput] = useState(server?.invite_url ?? '')
  const [description, setDescription] = useState(server?.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [inviteTouched, setInviteTouched] = useState(false)

  const inviteUrl = normalizeInviteUrl(inviteInput)
  const inviteInvalid = inviteInput.trim() !== '' && !inviteUrl
  const inviteChanged = server && inviteUrl && inviteUrl !== server.invite_url
  const requirement =
    name.trim() === ''
      ? '서버 이름을 입력해 주세요'
      : !inviteUrl
        ? '디스코드 초대 링크를 입력해 주세요'
        : null

  async function handleSubmit() {
    setIsSaving(true)
    setSaveError(null)
    const fields = { name, gameId, description, inviteUrl }
    try {
      if (server) await updateServer(server.id, fields)
      else await createServer(user.id, fields)
      navigate('/profile', {
        state: {
          notice:
            server && !inviteChanged
              ? '서버 정보를 저장했어요'
              : '등록했어요. 확인 후 커뮤니티에 공개돼요',
        },
      })
    } catch (error) {
      setSaveError(serverErrorMessage(error))
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`‘${server.name}’ 서버를 삭제할까요? 커뮤니티에서도 사라져요.`)) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await deleteServer(server.id)
      navigate('/profile', { state: { notice: '서버를 삭제했어요' } })
    } catch (error) {
      setSaveError(serverErrorMessage(error))
      setIsSaving(false)
    }
  }

  return (
    <EditScreen
      title={server ? '내 서버 수정' : '디스코드 서버 등록'}
      description={
        server
          ? `지금 상태: ${SERVER_STATUS_LABEL[server.status]}`
          : '운영하는 서버를 등록하면 확인 후 커뮤니티 탭에 공개돼요.'
      }
      error={saveError}
      requirement={requirement}
      isSaving={isSaving}
      submitLabel={server ? '저장하기' : '등록하기'}
      onSubmit={handleSubmit}
      extraAction={
        server && (
          <button
            type="button"
            className={styles.dangerButton}
            onClick={handleDelete}
            disabled={isSaving}
          >
            서버 삭제
          </button>
        )
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (!requirement && !isSaving) handleSubmit()
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>
            서버 이름 <span className={styles.required}>필수</span>
          </span>
          <input
            className={styles.input}
            value={name}
            maxLength={SERVER_NAME_MAX_LENGTH}
            placeholder="예: 별빛 롤 내전방"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            초대 링크 <span className={styles.required}>필수</span>
          </span>
          <input
            className={styles.input}
            value={inviteInput}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://discord.gg/abc123"
            aria-invalid={inviteTouched && inviteInvalid}
            aria-describedby="invite-help"
            onChange={(event) => setInviteInput(event.target.value)}
            onBlur={() => setInviteTouched(true)}
            required
          />
          <span
            id="invite-help"
            className={inviteTouched && inviteInvalid ? styles.errorText : styles.help}
          >
            {inviteTouched && inviteInvalid
              ? 'discord.gg/… 또는 discord.com/invite/… 형식의 링크를 넣어 주세요.'
              : '디스코드 서버 → 초대하기 → 링크 편집에서 만료 기간을 ‘만료 없음’으로 바꾼 뒤 복사해 주세요.'}
          </span>
          {inviteChanged && server.status !== 'pending' && (
            <span className={styles.help}>링크를 바꾸면 다시 확인을 받아야 공개돼요.</span>
          )}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>대표 게임</span>
          <select
            className={styles.input}
            value={gameId ?? ''}
            onChange={(event) => setGameId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">여러 게임 / 선택 안 함</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>소개</span>
          <textarea
            className={styles.textarea}
            value={description}
            maxLength={SERVER_DESCRIPTION_MAX_LENGTH}
            rows={4}
            placeholder="예: 매주 금요일 밤 내전해요. 골드 이하 뉴비 환영!"
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className={styles.counter}>
            {description.length} / {SERVER_DESCRIPTION_MAX_LENGTH}
          </span>
        </label>
      </form>
    </EditScreen>
  )
}
