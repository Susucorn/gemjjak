import { useId, useRef, useState } from 'react'
import { MAX_SERVER_GAMES } from '../../services/serverService'
import {
  MAX_GAME_NAME_LENGTH,
  findExactGame,
  matchesQuery,
  normalize,
} from '../onboarding/gameSearch'
import styles from './GamePicker.module.css'

/**
 * 서버 대표 게임 고르기(여러 개). 고른 게임은 입력창 위에 칩으로 보이고 ×로 뺀다.
 * 입력창에 쓰면 아래 목록이 이름·별명으로 좁혀지고, 누르면 고르거나 뺀다.
 * 목록에 없는 이름은 "직접 추가"로 넣는다. 목록 게임의 이름·별명과 같으면 그 게임을 고른 것으로 본다.
 * 아무것도 고르지 않으면 "여러 게임"이다.
 * 브라우저 기본 <select>는 펼친 목록의 모양을 바꿀 수 없어 직접 만든 목록을 쓴다.
 *
 * onChange({ gameIds, customGames })
 */
export function GamePicker({ games, initialGameIds, initialCustomGames, onChange }) {
  const [gameIds, setGameIds] = useState(initialGameIds)
  const [customGames, setCustomGames] = useState(initialCustomGames)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const listId = useId()
  const helpId = useId()

  const gameById = new Map(games.map((game) => [game.id, game]))
  const selectedIds = new Set(gameIds)
  const total = gameIds.length + customGames.length
  const isFull = total >= MAX_SERVER_GAMES
  const trimmed = query.trim()
  const exact = findExactGame(games, query)
  const alreadyCustom = customGames.some((name) => normalize(name) === normalize(trimmed))

  const options = [
    ...games
      .filter((game) => matchesQuery(game, query))
      .map((game) => ({ key: `g${game.id}`, label: game.name, game })),
    ...(trimmed && !exact && !alreadyCustom
      ? [{ key: 'custom', label: `‘${trimmed}’ 직접 추가`, custom: trimmed }]
      : []),
  ]

  function commit(nextIds, nextCustoms) {
    setGameIds(nextIds)
    setCustomGames(nextCustoms)
    onChange({ gameIds: nextIds, customGames: nextCustoms })
  }

  function toggleGame(id) {
    if (selectedIds.has(id))
      commit(
        gameIds.filter((item) => item !== id),
        customGames,
      )
    else if (!isFull) commit([...gameIds, id], customGames)
  }

  function addCustom(name) {
    if (isFull) return
    commit(gameIds, [...customGames, name])
  }

  function choose(option) {
    if (option.game) toggleGame(option.game.id)
    else addCustom(option.custom)
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function removeLast() {
    if (customGames.length > 0) commit(gameIds, customGames.slice(0, -1))
    else if (gameIds.length > 0) commit(gameIds.slice(0, -1), customGames)
  }

  function moveActive(step) {
    if (options.length === 0) return
    const next = isOpen ? (activeIndex + step + options.length) % options.length : 0
    setIsOpen(true)
    setActiveIndex(next)
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Enter') {
      // 서버 등록 양식이 제출되지 않도록 항상 막는다.
      event.preventDefault()
      if (event.nativeEvent.isComposing) return
      if (isOpen && activeIndex >= 0) choose(options[activeIndex])
      else if (exact) choose({ game: exact })
      else if (trimmed && !alreadyCustom) choose({ custom: trimmed })
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
    } else if (event.key === 'Backspace' && query === '') {
      removeLast()
    }
  }

  const help = isFull
    ? `최대 ${MAX_SERVER_GAMES}개까지 고를 수 있어요.`
    : trimmed
      ? 'Enter를 누르거나 목록에서 눌러야 추가돼요.'
      : total === 0
        ? '여러 개 고를 수 있어요. 고르지 않으면 ‘여러 게임’으로 보여요.'
        : `${total}개 골랐어요. 목록에 없는 게임은 이름을 입력해 직접 추가해요.`

  return (
    <div className={styles.picker}>
      {total > 0 && (
        <ul className={styles.chips} aria-label="고른 게임">
          {gameIds.map((id) => (
            <Chip
              key={`g${id}`}
              label={gameById.get(id)?.name ?? '알 수 없는 게임'}
              onRemove={() =>
                commit(
                  gameIds.filter((item) => item !== id),
                  customGames,
                )
              }
            />
          ))}
          {customGames.map((name) => (
            <Chip
              key={`c${name}`}
              label={name}
              custom
              onRemove={() =>
                commit(
                  gameIds,
                  customGames.filter((item) => item !== name),
                )
              }
            />
          ))}
        </ul>
      )}

      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          maxLength={MAX_GAME_NAME_LENGTH}
          placeholder="게임 이름 검색 또는 직접 입력 (예: 배그)"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-activedescendant={
            isOpen && activeIndex >= 0 && options[activeIndex]
              ? `${listId}-${options[activeIndex].key}`
              : undefined
          }
          aria-describedby={helpId}
          aria-label="대표 게임 추가"
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
        />
        <span className={styles.chevron} aria-hidden="true" />

        {isOpen && options.length > 0 && (
          <ul
            ref={listRef}
            id={listId}
            className={styles.list}
            role="listbox"
            aria-label="게임 목록"
            aria-multiselectable="true"
          >
            {options.map((option, index) => {
              const selected = option.game ? selectedIds.has(option.game.id) : false
              const disabled = !selected && isFull
              return (
                <li
                  key={option.key}
                  id={`${listId}-${option.key}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled || undefined}
                  className={[
                    styles.option,
                    index === activeIndex ? styles.active : '',
                    selected ? styles.selected : '',
                    option.custom ? styles.custom : '',
                    disabled ? styles.disabled : '',
                  ].join(' ')}
                  // 누르는 동안 입력창의 초점이 빠져 목록이 닫히지 않게 한다.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => !disabled && choose(option)}
                >
                  <span className={styles.check} aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  {option.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <span id={helpId} className={styles.help}>
        {help}
      </span>
    </div>
  )
}

function Chip({ label, custom = false, onRemove }) {
  return (
    <li className={`${styles.chip} ${custom ? styles.chipCustom : ''}`}>
      {label}
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`${label} 빼기`}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  )
}
