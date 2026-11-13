import { useState } from 'react'
import { GameTile } from '../../components/ui/GameTile'
import {
  MAX_CUSTOM_GAMES,
  MAX_GAME_NAME_LENGTH,
  POPULAR_GAME_COUNT,
  findExactGame,
  matchesQuery,
  normalize,
} from './gameSearch'
import styles from './Onboarding.module.css'

const MAX_SUGGESTIONS = 5

/**
 * 인기 게임 몇 개만 카드로 보여 주고, 나머지는 검색하거나 이름을 직접 입력한다.
 * 직접 입력한 게임은 승인 없이 바로 저장되고 같은 이름을 입력한 사람끼리 매칭된다.
 */
export function GameStep({
  games,
  genreNameById,
  selectedIds,
  customGames,
  onToggle,
  onAddCustom,
  onRemoveCustom,
}) {
  const [query, setQuery] = useState('')
  const trimmedQuery = query.trim()
  const isSearching = trimmedQuery.length > 0

  const popularGames = games.slice(0, POPULAR_GAME_COUNT)
  const suggestions = isSearching
    ? games.filter((game) => matchesQuery(game, trimmedQuery)).slice(0, MAX_SUGGESTIONS)
    : []
  // "롤"처럼 목록에 있는 게임을 직접 입력하면 새로 만들지 않고 그 게임을 고르게 한다.
  const exactGame = findExactGame(games, trimmedQuery)
  const alreadyAdded = customGames.some((name) => normalize(name) === normalize(trimmedQuery))
  const canAddCustom =
    isSearching &&
    normalize(trimmedQuery) !== '' &&
    !exactGame &&
    !alreadyAdded &&
    customGames.length < MAX_CUSTOM_GAMES

  const selectedGames = games.filter((game) => selectedIds.has(game.id))
  const hasSelection = selectedGames.length > 0 || customGames.length > 0

  function selectFromSearch(game) {
    onToggle(game.id)
    setQuery('')
  }

  function addCustom() {
    onAddCustom(trimmedQuery)
    setQuery('')
  }

  function handleEnter() {
    if (exactGame) {
      if (!selectedIds.has(exactGame.id)) onToggle(exactGame.id)
      setQuery('')
    } else if (canAddCustom) {
      addCustom()
    }
  }

  return (
    <div className={styles.gameStep}>
      {hasSelection && (
        <section className={styles.selection} aria-label="고른 게임">
          <ul className={styles.selectionList}>
            {selectedGames.map((game) => (
              <li key={game.id}>
                <button
                  type="button"
                  className={styles.selectionChip}
                  onClick={() => onToggle(game.id)}
                  aria-label={`${game.name} 빼기`}
                >
                  {game.name}
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
            {customGames.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={styles.selectionChip}
                  onClick={() => onRemoveCustom(name)}
                  aria-label={`${name} 빼기`}
                >
                  {name}
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          placeholder="다른 게임 검색 또는 직접 입력"
          aria-label="게임 이름 검색 또는 직접 입력"
          value={query}
          maxLength={MAX_GAME_NAME_LENGTH}
          enterKeyHint="done"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              handleEnter()
            }
          }}
        />
      </div>

      {isSearching ? (
        <ul className={styles.suggestions} aria-label="검색 결과">
          {suggestions.map((game) => {
            const selected = selectedIds.has(game.id)
            return (
              <li key={game.id}>
                <button
                  type="button"
                  className={`${styles.suggestion} ${selected ? styles.suggestionSelected : ''}`}
                  aria-pressed={selected}
                  onClick={() => selectFromSearch(game)}
                >
                  <GameTile
                    name={game.name}
                    genre={genreNameById.get(game.genre_id)}
                    className={styles.suggestionTile}
                  />
                  <span className={styles.suggestionName}>{game.name}</span>
                  <span className={styles.suggestionAction}>{selected ? '선택됨' : '고르기'}</span>
                </button>
              </li>
            )
          })}
          {canAddCustom && (
            <li>
              <button
                type="button"
                className={`${styles.suggestion} ${styles.suggestionCustom}`}
                onClick={addCustom}
              >
                <span className={styles.customTile} aria-hidden="true">
                  +
                </span>
                <span className={styles.suggestionName}>‘{trimmedQuery}’ 직접 추가</span>
              </button>
            </li>
          )}
          {alreadyAdded && <li className={styles.suggestionNote}>이미 추가한 게임이에요.</li>}
          {!exactGame && !alreadyAdded && customGames.length >= MAX_CUSTOM_GAMES && (
            <li className={styles.suggestionNote}>
              게임은 {MAX_CUSTOM_GAMES}개까지 직접 추가할 수 있어요.
            </li>
          )}
        </ul>
      ) : (
        <section aria-labelledby="popular-games-title" className={styles.popular}>
          <h2 id="popular-games-title" className={styles.popularTitle}>
            인기 게임
          </h2>
          <ul className={styles.gameGrid}>
            {popularGames.map((game) => {
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
          <p className={styles.popularHint}>
            여기 없는 게임은 위 검색창에 이름을 입력해서 추가하세요.
          </p>
        </section>
      )}
    </div>
  )
}
