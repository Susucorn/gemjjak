// 랜딩 페이지 섹션마다 붙는 작은 미리보기. 실제 화면을 단순하게 그린 것이라 눌러도 동작하지 않는다.
// 스크린 리더에는 각 섹션 글로 같은 내용을 전하므로 그림은 aria-hidden으로 숨긴다.

import { MatchCard } from '../../components/match/MatchCard'
import { DiscordIcon } from '../../components/ui/DiscordIcon'
import { GameTile } from '../../components/ui/GameTile'
import { DAYS, HOURS } from '../onboarding/hours'
import styles from './Landing.module.css'

/** 01 궁합 점수: 세 항목이 합쳐져 하나의 점수가 되는 모습 */
export function ScoreVisual() {
  const parts = [
    { label: '공통 게임', weight: 40, value: 40 },
    { label: '접속 시간 겹침', weight: 35, value: 32 },
    { label: '플레이 스타일', weight: 25, value: 23 },
  ]
  return (
    <div className={styles.visualCard} aria-hidden="true">
      {parts.map((part) => (
        <div key={part.label} className={styles.scoreRow}>
          <p className={styles.scoreRowLabel}>
            {part.label}
            <span>{part.weight}%</span>
          </p>
          <span className={styles.scoreTrack}>
            <span
              className={styles.scoreFill}
              style={{ width: `${(part.value / part.weight) * 100}%` }}
            />
          </span>
        </div>
      ))}
      <p className={styles.scoreTotal}>
        궁합 <strong>95%</strong>
      </p>
    </div>
  )
}

/** 02 취향 프로필: 게임 타일 + 직접 추가 + 요일별 시간 막대 */
export function ProfileVisual() {
  const week = { 1: [20, 21, 22], 3: [20, 21, 22], 5: [20, 21, 22], 6: [13, 14, 15, 16] }
  return (
    <div className={styles.visualCard} aria-hidden="true">
      <div className={styles.gameRow}>
        {[
          ['원신', '오픈월드 RPG'],
          ['리그 오브 레전드', 'MOBA'],
          ['발로란트', 'FPS·슈팅'],
        ].map(([name, genre]) => (
          <div key={name} className={styles.gameItem}>
            <GameTile name={name} genre={genre} />
            <span>{name}</span>
          </div>
        ))}
      </div>
      <p className={styles.addChip}>+ 카트라이더 직접 추가</p>
      <div className={styles.week}>
        {DAYS.map((day) => (
          <div key={day.key} className={styles.weekRow}>
            <span>{day.label}</span>
            <span className={styles.weekBar}>
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className={week[day.key]?.includes(hour) ? styles.weekOn : styles.weekOff}
                />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function samplePlayer(nickname, games, tags) {
  return {
    id: nickname,
    nickname,
    avatarUrl: null,
    games: new Map(games.map((name, index) => [`g:${index}`, name])),
    tags: new Map(tags.map((tag, index) => [`t:${index}`, tag])),
  }
}

/** 히어로: 실제 앱의 추천 카드를 예시 데이터로 그린다. */
export function MatchVisual() {
  return (
    <div aria-hidden="true">
      <MatchCard
        player={samplePlayer(
          '별빛여행자',
          ['원신', '붕괴: 스타레일'],
          ['즐겜', '보이스OK', '뉴비환영'],
        )}
        match={{
          score: 95,
          commonTags: ['즐겜', '보이스OK'],
          reasons: ['공통 게임 원신', '월·수·금 21시–23시가 겹쳐요'],
        }}
      />
    </div>
  )
}

/** 03 오늘의 추천: 홈 화면처럼 작은 카드 두 장 */
export function RecommendVisual() {
  return (
    <div className={styles.recommendGrid} aria-hidden="true">
      <MatchCard
        compact
        player={samplePlayer('칼바람장인', ['리그 오브 레전드'], ['즐겜', '보이스OK'])}
        match={{ score: 88, commonTags: ['즐겜'], reasons: ['공통 게임 리그 오브 레전드'] }}
      />
      <MatchCard
        compact
        player={samplePlayer('파도타기', ['원신', '명조'], ['즐겜', '월드 탐사'])}
        match={{ score: 74, commonTags: ['월드 탐사'], reasons: ['화·목 20시–23시가 겹쳐요'] }}
      />
    </div>
  )
}

/** 04 1:1 채팅: 매칭 근거 + 말풍선 + 빠른 답장 칩 */
export function ChatVisual() {
  return (
    <div className={styles.visualCard} aria-hidden="true">
      <p className={styles.chatBanner}>궁합 95% · 공통 게임 원신 · 밤 9시 이후</p>
      <div className={styles.bubbles}>
        <p className={`${styles.bubble} ${styles.bubbleOther}`}>
          안녕하세요! 오늘 비경 같이 도실래요?
        </p>
        <p className={`${styles.bubble} ${styles.bubbleMe}`}>좋아요 9시에 접속할게요 🙌</p>
      </div>
      <div className={styles.quickReplies}>
        <span>지금 접속 중이에요</span>
        <span>디스코드 아이디 알려 주세요</span>
      </div>
    </div>
  )
}

/** 05 디스코드 커뮤니티: 서버 카드와 참여 버튼 */
export function CommunityVisual() {
  return (
    <div className={styles.visualCard} aria-hidden="true">
      {[
        {
          name: '별빛 롤 내전방',
          game: '리그 오브 레전드',
          members: 1240,
          online: 312,
          joined: false,
        },
        { name: '원신 협동 길드', game: '원신', members: 860, online: 145, joined: true },
      ].map((server) => (
        <div key={server.name} className={styles.server}>
          <span className={styles.serverIcon}>
            <DiscordIcon size={20} />
          </span>
          <span className={styles.serverText}>
            <strong>{server.name}</strong>
            <span>
              {server.game} · 멤버 {server.members.toLocaleString()} ·{' '}
              <span className={styles.online}>● {server.online} 온라인</span>
            </span>
          </span>
          <span className={server.joined ? styles.joined : styles.join}>
            {server.joined ? '참여 중' : '참여'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 06 AI 도우미: 질문하면 조건을 해석해 사용자 목록을 보여 준다. */
export function AiVisual() {
  return (
    <div className={styles.visualCard} aria-hidden="true">
      <p className={`${styles.bubble} ${styles.bubbleMe}`}>
        주말 오후에 원신 같이 할 뉴비환영 유저 있어?
      </p>
      <div className={styles.aiAnswer}>
        <p className={styles.aiLabel}>✦ AI 도우미</p>
        <p className={styles.aiText}>토·일 오후에 원신을 하는 뉴비환영 게이머 2명을 찾았어요.</p>
        <ul className={styles.aiList}>
          <li>
            파도타기 <strong>82%</strong>
          </li>
          <li>
            새내기게이머 <strong>76%</strong>
          </li>
        </ul>
      </div>
    </div>
  )
}
