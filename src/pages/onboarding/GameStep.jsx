import { useState } from 'react'
import { GameTile } from '../../components/ui/GameTile'
import { PLATFORMS, matchesPlatform, matchesQuery, normalize } from './gameSearch'
import styles from './Onboarding.module.css'

const MAX_REQUEST_LENGTH = 40

export function GameStep({
  games,
  genreNameById,
  selectedIds,
  requestedGames,
  onToggle,
  onRequest,
  onRemoveRequest,
}) {
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('all')

  const trimmedQuery = query.trim()
  const visibleGames = games.filter(
    (game) => matchesPlatform(game, platform) && matchesQuery(game, trimmedQuery),
  )
  // 다른 플랫폼 탭에 있는 게임을 "목록에 없음"으로 착각해 요청하지 않게 한다.
  const otherPlatformCount =
    visibleGames.length === 0 && platform !== 'all'
      ? games.filter((game) => matchesQuery(game, trimmedQuery)).length
      : 0
  // 검색어와 정확히 같은 게임이 목록이나 요청에 이미 있으면 요청 버튼을 보여 주지 않는다.
  const exactMatch =
    games.some((game) =>
      [game.name, ...game.aliases].some((label) => normalize(label) === normalize(trimmedQuery)),
    ) || requestedGames.some((name) => normalize(name) === normalize(trimmedQuery))
  const canRequest =
    trimmedQuery.length > 0 && trimmedQuery.length <= MAX_REQUEST_LENGTH && !exactMatch

  const selectedGames = games.filter((game) => selectedIds.has(game.id))
  const hasSelection = selectedGames.length > 0 || requestedGames.length > 0

  function handleRequest() {
    onRequest(trimmedQuery)
    setQuery('')
  }

  return (
    <div className={styles.gameStep}>
      <div className={styles.searchBox}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="게임 이름 검색 (예: 롤, 배그, 메이플)"
          aria-label="게임 이름 검색"
          value={query}
          maxLength={MAX_REQUEST_LENGTH}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              visibleGames.length === 0 &&
              otherPlatformCount === 0 &&
              canRequest
            )
              handleRequest()
          }}
        />
      </div>

      <div className={styles.platformTabs} role="group" aria-label="플랫폼">
        {PLATFORMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.platformTab} ${platform === item.key ? styles.platformTabActive : ''}`}
            aria-pressed={platform === item.key}
            onClick={() => setPlatform(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {hasSelection && (
        <section className={styles.selection} aria-label="고른 게임">
          <ul className={styles.selectionList}>
            {selectedGames.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className={styles.selectionChip}
                  onClick={() => onToggle(game.id)}
                  aria-label={`${game.name} 선택 해제`}
                >
                  {game.name}
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
            {requestedGames.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={`${styles.selectionChip} ${styles.selectionChipRequested}`}
                  onClick={() => onRemoveRequest(name)}
                  aria-label={`${name} 추가 요청 취소`}
                >
                  {name}
                  <span className={styles.requestBadge}>요청</span>
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
          {requestedGames.length > 0 && (
            <p className={styles.selectionNote}>
              요청한 게임은 확인 후 목록에 추가돼요. 그 전에는 좋아하는 장르로 추천해 드려요.
            </p>
          )}
        </section>
      )}

      {visibleGames.length > 0 ? (
        <ul className={styles.gameGrid}>
          {visibleGames.map((game) => {
            const selected = selectedIds.has(game.id)
            return (
              <li key={game.id}>
                <button
                  type="button"
                  className={`${styles.gameCard} ${selected ? styles.gameCardSelected : ''}`}
                  aria-pressed={selected}
                  onClick={() => onToggle(game.id)}
                >
                  <GameTile name={game.name} genre={genreNameById.get(game.genre_id)} />
                  <span className={styles.gameName}>{game.name}</span>
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {otherPlatformCount > 0
              ? '이 플랫폼에는 없지만 다른 플랫폼에 있어요'
              : trimmedQuery
                ? `‘${trimmedQuery}’ 게임이 목록에 없어요`
                : '이 플랫폼의 게임이 없어요'}
          </p>
          {otherPlatformCount > 0 ? (
            <button
              type="button"
              className={styles.requestButton}
              onClick={() => setPlatform('all')}
            >
              전체에서 {otherPlatformCount}개 보기
            </button>
          ) : (
            canRequest && (
              <>
                <p className={styles.emptyText}>추가를 요청하면 확인 후 목록에 넣어 드려요.</p>
                <button type="button" className={styles.requestButton} onClick={handleRequest}>
                  ‘{trimmedQuery}’ 추가 요청하기
                </button>
              </>
            )
          )}
        </div>
      )}
    </div>
  )
}
