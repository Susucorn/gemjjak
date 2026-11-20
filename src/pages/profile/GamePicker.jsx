import { useId, useRef, useState } from 'react'
import { MAX_GAME_NAME_LENGTH, findExactGame, matchesQuery } from '../onboarding/gameSearch'
import styles from './GamePicker.module.css'

/**
 * 서버 대표 게임 고르기. 입력창에 쓰면 아래 목록이 이름·별명으로 좁혀지고, 목록에서 고르거나
 * 목록에 없는 이름을 그대로 둘 수 있다.
 *
 * 입력한 글자가 곧 값이다.
 *   목록 게임의 이름·별명과 같으면 그 게임({ gameId })
 *   그 외 글자가 있으면 직접 입력한 게임({ customGame })
 *   비어 있으면 "여러 게임 / 선택 안 함"({ gameId: null, customGame: null })
 * 브라우저 기본 <select>는 펼친 목록의 모양을 바꿀 수 없어 직접 만든 목록을 쓴다.
 */
export function GamePicker({ games, initialText, onChange }) {
  const [text, setText] = useState(initialText)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef(null)
  const listId = useId()
  const helpId = useId()

  const exact = findExactGame(games, text)
  const trimmed = text.trim()
  const filtered = exact ? games : games.filter((game) => matchesQuery(game, text))
  // 맨 위는 "선택 안 함", 글자가 있고 같은 게임이 없으면 맨 아래에 "직접 입력"을 둔다.
  const options = [
    { key: 'none', label: '여러 게임 / 선택 안 함', value: '' },
    ...filtered.map((game) => ({ key: `g${game.id}`, label: game.name, value: game.name })),
    ...(trimmed && !exact
      ? [{ key: 'custom', label: `‘${trimmed}’ 직접 입력`, value: trimmed, custom: true }]
      : []),
  ]

  function update(nextText) {
    setText(nextText)
    const match = findExactGame(games, nextText)
    onChange(
      match
        ? { gameId: match.id, customGame: null }
        : { gameId: null, customGame: nextText.trim() || null },
    )
  }

  function choose(option) {
    update(option.value)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function moveActive(step) {
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
    } else if (event.key === 'Enter' && isOpen && activeIndex >= 0) {
      event.preventDefault()
      choose(options[activeIndex])
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
    }
  }

  const status = exact
    ? `${exact.name}(으)로 저장돼요.`
    : trimmed
      ? '목록에 없는 게임이라 입력한 이름 그대로 저장돼요.'
      : '목록에서 고르거나, 없으면 게임 이름을 직접 입력해 주세요.'

  return (
    <div className={styles.picker}>
      <input
        className={styles.input}
        value={text}
        maxLength={MAX_GAME_NAME_LENGTH}
        placeholder="게임 이름 검색 또는 직접 입력 (예: 배그)"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? `${listId}-${options[activeIndex].key}` : undefined
        }
        aria-describedby={helpId}
        aria-label="대표 게임"
        onChange={(event) => {
          update(event.target.value)
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
      />
      <span className={styles.chevron} aria-hidden="true" />
      {isOpen && (
        <ul ref={listRef} id={listId} className={styles.list} role="listbox" aria-label="게임 목록">
          {options.map((option, index) => {
            const selected = option.custom
              ? !exact && trimmed === option.value
              : option.value === (exact?.name ?? (trimmed ? null : ''))
            return (
              <li
                key={option.key}
                id={`${listId}-${option.key}`}
                role="option"
                aria-selected={selected}
                className={[
                  styles.option,
                  index === activeIndex ? styles.active : '',
                  selected ? styles.selected : '',
                  option.custom ? styles.custom : '',
                ].join(' ')}
                // 누르는 동안 입력창의 초점이 빠져 목록이 닫히지 않게 한다.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </li>
            )
          })}
        </ul>
      )}
      <span id={helpId} className={styles.help}>
        {status}
      </span>
    </div>
  )
}
