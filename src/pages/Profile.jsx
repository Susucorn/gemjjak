import { useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { DiscordIcon } from '../components/ui/DiscordIcon'
import { GameTile } from '../components/ui/GameTile'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { isDiscordUser, signOut } from '../services/authService'
import { fetchMyPreferences, fetchPreferenceOptions } from '../services/preferencesService'
import { SERVER_STATUS_LABEL, fetchMyServers } from '../services/serverService'
import { DAYS, HOURS, describeHours, totalHours } from './onboarding/hours'
import styles from './Profile.module.css'

export function Profile() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const notice = location.state?.notice

  const load = useCallback(
    () =>
      Promise.all([
        fetchPreferenceOptions(),
        fetchMyPreferences(user.id),
        fetchMyServers(user.id),
      ]).then(([options, prefs, servers]) => ({ options, prefs, servers })),
    [user.id],
  )
  const loaded = useLoader(load)

  // 저장 완료 안내는 이번 한 번만 보여 준다. 새로고침하면 사라지도록 기록에서 지운다.
  useEffect(() => {
    if (notice) window.history.replaceState({ ...window.history.state, usr: null }, '')
  }, [notice])

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>프로필</h1>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <ProfileHeader user={user} profile={profile} />

      {loaded.status === 'loading' && (
        <p className={styles.status} role="status">
          불러오는 중이에요
        </p>
      )}
      {loaded.status === 'error' && (
        <div className={styles.status}>
          <p>프로필 정보를 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded.status === 'ready' && <ProfileDetails {...loaded.data} />}

      <button type="button" className={styles.signOut} onClick={() => signOut().catch(() => {})}>
        로그아웃
      </button>
    </div>
  )
}

function ProfileHeader({ user, profile }) {
  const meta = user?.user_metadata ?? {}
  const isDiscord = isDiscordUser(user)
  // full_name은 디스코드 사용자명(@아이디)이고 닉네임은 겜짝에서 쓰는 이름이다.
  const discordName = meta.full_name ?? meta.name

  return (
    <section className={styles.header} aria-label="내 프로필">
      <Avatar src={profile?.avatar_url} name={profile?.nickname} size={72} />
      <div className={styles.identity}>
        <p className={styles.nickname}>{profile?.nickname}</p>
        {isDiscord ? (
          <p className={styles.discord}>
            <DiscordIcon size={16} />
            디스코드 연결됨
            {discordName && <span className={styles.discordName}>@{discordName}</span>}
          </p>
        ) : (
          <p className={styles.account}>
            구글 계정 연결됨
            {user?.email && <span className={styles.discordName}>{user.email}</span>}
          </p>
        )}
      </div>
      <p className={profile?.bio ? styles.bio : styles.bioEmpty}>
        {profile?.bio || '아직 소개가 없어요. 어떤 게이머인지 한 줄로 알려 주세요.'}
      </p>
      <Link to="/profile/edit/info" className={styles.editProfile}>
        프로필 수정
      </Link>
    </section>
  )
}

function ProfileDetails({ options, prefs, servers }) {
  const genreNameById = new Map(options.genres.map((genre) => [genre.id, genre.name]))
  const myGames = options.games.filter((game) => prefs.gameIds.has(game.id))
  const myGenres = options.genres.filter((genre) => prefs.genreIds.has(genre.id))
  const categoryOf = new Map(options.vocabulary.map((item) => [item.tag, item.category]))
  const tagsIn = (category) => [
    ...[...prefs.tags].filter((tag) => categoryOf.get(tag) === category),
    ...prefs.customTags[category],
  ]
  const weeklyHours = totalHours(prefs.hours)

  return (
    <>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>하는 게임</dt>
          <dd>{myGames.length + prefs.customGames.length}개</dd>
        </div>
        <div className={styles.stat}>
          <dt>주간 접속</dt>
          <dd>{weeklyHours}시간</dd>
        </div>
        <div className={styles.stat}>
          <dt>내 서버</dt>
          <dd>{servers.length}개</dd>
        </div>
      </dl>

      <div className={styles.sections}>
        <Section title="내가 하는 게임" editTo="/profile/edit/games">
          <ul className={styles.gameList}>
            {myGames.map((game) => (
              <li key={game.id} className={styles.gameItem}>
                <GameTile
                  name={game.name}
                  genre={genreNameById.get(game.genre_id)}
                  className={styles.gameTile}
                />
                <span>{game.name}</span>
              </li>
            ))}
            {prefs.customGames.map((name) => (
              <li key={name} className={styles.gameItem}>
                <span className={styles.customTile} aria-hidden="true">
                  {name.slice(0, 1)}
                </span>
                <span>{name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="플레이 스타일" editTo="/profile/edit/style">
          <TagRow
            label="좋아하는 장르"
            tags={[...myGenres.map((genre) => genre.name), ...prefs.customGenres]}
          />
          <TagRow label="스타일" tags={tagsIn('style')} />
          <TagRow label="콘텐츠" tags={tagsIn('activity')} />
          <TagRow label="찾는 사람" tags={tagsIn('want')} />
        </Section>

        <Section title="접속 시간" editTo="/profile/edit/time">
          <div className={styles.hourList}>
            {DAYS.map((day) => (
              <HourBar key={day.key} label={day.label} hours={prefs.hours[day.key]} />
            ))}
            <HourAxis />
          </div>
        </Section>

        <Section
          title="내 디스코드 서버"
          editTo="/profile/servers/new"
          editLabel="등록"
          editAriaLabel="디스코드 서버 등록"
        >
          {servers.length === 0 ? (
            <p className={styles.emptyText}>
              운영하는 디스코드 서버가 있다면 등록해 보세요. 확인 후 커뮤니티 탭에 공개돼요. 없으면
              등록하지 않아도 괜찮아요.
            </p>
          ) : (
            <ul className={styles.serverList}>
              {servers.map((server) => (
                <li key={server.id}>
                  <Link to={`/profile/servers/${server.id}`} className={styles.serverItem}>
                    <span className={styles.serverIcon} aria-hidden="true">
                      <DiscordIcon size={20} />
                    </span>
                    <span className={styles.serverText}>
                      <span className={styles.serverName}>{server.name}</span>
                      <span className={styles.serverMeta}>
                        {options.games.find((game) => game.id === server.game_id)?.name ??
                          '여러 게임'}
                      </span>
                    </span>
                    <span className={`${styles.statusBadge} ${styles[server.status]}`}>
                      {SERVER_STATUS_LABEL[server.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function Section({ title, editTo, editLabel = '수정', editAriaLabel, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <Link
          to={editTo}
          className={styles.sectionAction}
          aria-label={editAriaLabel ?? `${title} ${editLabel}`}
        >
          {editLabel}
        </Link>
      </div>
      {children}
    </section>
  )
}

function TagRow({ label, tags }) {
  if (tags.length === 0) return null
  return (
    <div className={styles.tagRow}>
      <p className={styles.tagLabel}>{label}</p>
      <ul className={styles.tags}>
        {tags.map((tag) => (
          <li key={tag} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 요일 한 줄: 요일 이름 + 24칸 막대. 색칠된 칸이 접속하는 시간이다. */
function HourBar({ label, hours }) {
  return (
    <div className={styles.hourRow}>
      <span className={styles.hourDay}>{label}</span>
      <div
        className={styles.hourBar}
        role="img"
        aria-label={`${label}요일 ${describeHours(hours)}`}
      >
        {HOURS.map((hour) => (
          <span key={hour} className={hours.has(hour) ? styles.hourOn : styles.hourOff} />
        ))}
      </div>
    </div>
  )
}

function HourAxis() {
  return (
    <div className={styles.hourAxis} aria-hidden="true">
      <span>0시</span>
      <span>6시</span>
      <span>12시</span>
      <span>18시</span>
      <span>24시</span>
    </div>
  )
}
