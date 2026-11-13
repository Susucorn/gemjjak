import { Link } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import styles from './MatchCard.module.css'

/**
 * 추천 게이머 카드. 궁합 %와 게이지, 공통점 태그, 추천 근거를 함께 보여 준다.
 * compact는 "나와 유사한 플레이어" 2열 그리드용 작은 카드다.
 * onChat을 넘기면 [채팅하기] 버튼을 붙인다. 소개 페이지의 예시 카드에는 넘기지 않는다.
 * profileTo를 넘기면 카드 전체를 눌러 프로필로 갈 수 있다. 닉네임 링크가 카드 전체를 덮고,
 * [채팅하기] 버튼만 그 위에 올라와 따로 눌린다(링크 안에 버튼을 넣지 않기 위한 방식).
 */
export function MatchCard({
  player,
  match,
  compact = false,
  onChat,
  isStartingChat = false,
  profileTo,
}) {
  const games = [...player.games.values()]
  // 공통 태그를 먼저 보여 주고, 남는 자리는 그 사람의 다른 태그로 채운다.
  const tags = [...new Set([...match.commonTags, ...player.tags.values()])].slice(
    0,
    compact ? 2 : 3,
  )
  const commonTagSet = new Set(match.commonTags)

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ''} ${profileTo ? styles.clickable : ''}`}
    >
      <div className={styles.header}>
        <Avatar src={player.avatarUrl} name={player.nickname} size={compact ? 40 : 48} />
        <div className={styles.name}>
          <h3 className={styles.nickname}>
            {profileTo ? (
              <Link
                to={profileTo}
                className={styles.profileLink}
                aria-label={`${player.nickname}님 프로필 보기`}
              >
                {player.nickname}
              </Link>
            ) : (
              player.nickname
            )}
          </h3>
          <p className={styles.games}>
            {games.length > 0 ? games.slice(0, 3).join(' · ') : '게임 정보 없음'}
          </p>
        </div>
        {!compact && (
          <p className={styles.score}>
            <span className={styles.scoreLabel}>궁합</span>
            {match.score}%
          </p>
        )}
      </div>

      {compact && (
        <p className={styles.compactScore}>
          궁합 <strong>{match.score}%</strong>
        </p>
      )}
      <div
        className={styles.gauge}
        role="meter"
        aria-label={`${player.nickname}님과 궁합`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={match.score}
      >
        <span className={styles.gaugeFill} style={{ width: `${match.score}%` }} />
      </div>

      {tags.length > 0 && (
        <ul className={styles.tags} aria-label="플레이 스타일">
          {tags.map((tag) => (
            <li
              key={tag}
              className={`${styles.tag} ${commonTagSet.has(tag) ? styles.tagCommon : ''}`}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {!compact && match.reasons.length > 0 && (
        <p className={styles.reason}>{match.reasons.slice(0, 2).join(' · ')}</p>
      )}
      {compact && match.reasons.length > 0 && (
        <p className={styles.compactReason}>{match.reasons[0]}</p>
      )}
      {onChat && (
        <button
          type="button"
          className={styles.chatButton}
          onClick={onChat}
          disabled={isStartingChat}
          aria-busy={isStartingChat}
          aria-label={`${player.nickname}님과 채팅하기`}
        >
          {isStartingChat ? '여는 중…' : '채팅하기'}
        </button>
      )}
    </article>
  )
}
