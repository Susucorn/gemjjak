import { Link } from 'react-router-dom'
import { Avatar } from '../ui/Avatar'
import styles from './MatchCard.module.css'

/**
 * 추천 게이머 카드. 궁합 %와 게이지 아래에 게임·스타일·겹치는 시간을 한 줄씩 보여 준다.
 * 나와 겹치는 게임과 스타일은 강조색으로 표시한다.
 * compact는 "나와 유사한 플레이어" 2열 그리드용 작은 카드다.
 * onChat을 넘기면 [채팅하기] 버튼을 붙인다(탐색 결과). 홈과 소개 페이지에는 넘기지 않는다.
 * profileTo를 넘기면 카드 전체를 눌러 프로필로 갈 수 있다. 닉네임 링크가 카드 전체를 덮고,
 * [채팅하기] 버튼만 그 위에 올라와 따로 눌린다(링크 안에 버튼을 넣지 않기 위한 방식).
 */
export function MatchCard({ player, match, compact = false, onChat, profileTo }) {
  const commonGameSet = new Set(match.commonGames ?? [])
  const commonTagSet = new Set(match.commonTags ?? [])
  // 겹치는 것을 먼저 보여 주고, 남는 자리는 그 사람의 다른 게임·태그로 채운다.
  const games = commonFirst([...player.games.values()], commonGameSet)
  const tags = commonFirst([...player.tags.values()], commonTagSet)
  const maxGames = compact ? 2 : 3
  const maxTags = compact ? 2 : 3

  return (
    <article
      className={`${styles.card} ${compact ? styles.compact : ''} ${profileTo ? styles.clickable : ''}`}
    >
      <div className={styles.header}>
        <Avatar src={player.avatarUrl} name={player.nickname} size={compact ? 40 : 48} />
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
        {!compact && (
          <p className={styles.score}>
            <span className={styles.scoreLabel}>궁합</span>
            {match.score}%
          </p>
        )}
      </div>

      {/* 작은 카드는 폭이 좁아 닉네임 옆 대신 아래 줄에 둔다. */}
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

      <dl className={styles.details}>
        <div className={styles.row}>
          <dt className={styles.label}>게임</dt>
          <dd className={styles.value}>
            {games.length === 0 ? (
              <span className={styles.none}>게임 정보 없음</span>
            ) : (
              <>
                {games.slice(0, maxGames).map((game, index) => (
                  <span key={game}>
                    {index > 0 && ', '}
                    <span className={commonGameSet.has(game) ? styles.common : undefined}>
                      {game}
                    </span>
                  </span>
                ))}
                {games.length > maxGames && (
                  <span className={styles.more}> 외 {games.length - maxGames}개</span>
                )}
              </>
            )}
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>스타일</dt>
          <dd className={styles.value}>
            {tags.length === 0 ? (
              <span className={styles.none}>아직 없어요</span>
            ) : (
              <ul className={styles.tags}>
                {tags.slice(0, maxTags).map((tag) => (
                  <li
                    key={tag}
                    className={`${styles.tag} ${commonTagSet.has(tag) ? styles.tagCommon : ''}`}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>

        <div className={styles.row}>
          <dt className={styles.label}>시간</dt>
          <dd className={styles.value}>
            {match.overlapText ? (
              <>
                <span className={styles.common}>{match.overlapText}</span> 겹쳐요
              </>
            ) : (
              <span className={styles.none}>겹치는 시간 없음</span>
            )}
          </dd>
        </div>
      </dl>

      {onChat && (
        <button
          type="button"
          className={styles.chatButton}
          onClick={onChat}
          aria-label={`${player.nickname}님과 채팅하기`}
        >
          채팅하기
        </button>
      )}
    </article>
  )
}

function commonFirst(names, commonSet) {
  return [...names.filter((name) => commonSet.has(name)), ...names.filter((n) => !commonSet.has(n))]
}
