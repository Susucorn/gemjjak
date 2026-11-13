import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MatchCard } from '../components/match/MatchCard'
import { Button } from '../components/ui/Button'
import { AddDialog } from '../components/ui/AddDialog'
import { Chip } from '../components/ui/Chip'
import { useAuth } from '../hooks/useAuth'
import { useLoader } from '../hooks/useLoader'
import { compatibility } from '../lib/compatibility'
import {
  emptyFilters,
  filterEntry,
  filtersFromConditions,
  isEmptyFilters,
  loadExploreState,
  matchFilters,
  popularOptions,
  saveExploreState,
} from '../lib/exploreFilters'
import {
  AI_QUESTION_MAX_LENGTH,
  aiSearchErrorMessage,
  askAiSearch,
} from '../services/aiSearchService'
import { startDirectChat } from '../services/chatService'
import { fetchPlayers } from '../services/matchService'
import { DAYS, TIME_PRESETS, dayLabel, presetHours } from './onboarding/hours'
import { ResultPages } from './explore/ResultPages'
import styles from './Explore.module.css'

const EXAMPLES = [
  '오늘 밤에 롤 같이 할 사람',
  '주말 낮에 편하게 마크할 친구',
  '평일 저녁 빡겜 발로란트 듀오',
]

/**
 * /explore — 조건에 맞는 게이머를 찾는다.
 * 검색 창은 "AI로 찾기"와 "필터로 찾기" 중 하나만 보이고, 버튼으로 서로 바꾼다.
 * 검색하기 전에는 결과를 보여 주지 않는다. 결과는 궁합 높은 순이다.
 */
export function Explore() {
  const { user } = useAuth()
  const load = useCallback(() => fetchPlayers(user.id), [user.id])
  const loaded = useLoader(load)
  const [mode, setModeState] = useState(() => loadExploreState()?.mode ?? 'ai')
  // 처음 열 때는 움직이지 않고, 버튼으로 바꿀 때만 옆으로 밀어 넣는다.
  const [flipped, setFlipped] = useState(false)
  function setMode(next) {
    if (next === mode) return
    setModeState(next)
    setFlipped(true)
    saveExploreState({ mode: next })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>탐색</h1>
          <p className={styles.subtitle}>원하는 조건을 알려 주면 맞는 게이머를 찾아 드려요</p>
        </div>
        <div className={styles.modeSwitch} role="group" aria-label="찾는 방법">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.modeButton} ${mode === item.key ? styles.modeActive : ''}`}
              aria-pressed={mode === item.key}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {loaded.status === 'loading' && (
        <p className={styles.status} role="status">
          게이머 목록을 불러오는 중이에요
        </p>
      )}
      {loaded.status === 'error' && (
        <div className={styles.status}>
          <p>게이머 목록을 불러오지 못했어요</p>
          <Button variant="secondary" onClick={loaded.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {loaded.status === 'ready' && (
        <ExploreBody {...loaded.data} mode={mode} flipped={flipped} onModeChange={setMode} />
      )}
    </div>
  )
}

function findPlayers(me, others, filters) {
  return others
    .filter((player) => matchFilters(player, filters))
    .map((player) => ({ player, match: compatibility(me, player) }))
    .sort((a, b) => b.match.score - a.match.score)
}

const MODES = [
  { key: 'ai', label: '✨ AI로 찾기' },
  { key: 'filter', label: '필터로 찾기' },
]

function ExploreBody({ me, others, catalog, mode, flipped, onModeChange: setMode }) {
  // 프로필을 보고 돌아왔을 때 이어서 보도록 저장해 둔 조건을 불러온다.
  const [saved] = useState(loadExploreState)
  // 필터 창에서 고르는 중인 조건
  const [draft, setDraft] = useState(() => saved?.draft ?? emptyFilters())
  // 마지막으로 검색한 조건. null이면 아직 검색 전이다.
  const [search, setSearch] = useState(() => saved?.search ?? null)
  const resultsRef = useRef(null)
  const restoringRef = useRef(Boolean(saved?.search))

  useEffect(() => saveExploreState({ draft }), [draft])
  useEffect(() => {
    if (search) saveExploreState({ search })
  }, [search])

  // 다른 화면으로 나갈 때 스크롤 위치를 기억한다.
  useEffect(() => () => saveExploreState({ scrollY: window.scrollY }), [])

  const draftCount = useMemo(
    () => (me ? others.filter((player) => matchFilters(player, draft)).length : 0),
    [me, others, draft],
  )
  const results = useMemo(
    () => (me && search ? findPlayers(me, others, search.filters) : []),
    [me, others, search],
  )

  // 검색하면 결과로 내려 준다. 돌아온 경우에는 보던 위치로 바로 옮긴다.
  useEffect(() => {
    if (restoringRef.current) {
      restoringRef.current = false
      window.scrollTo(0, saved.scrollY)
      return
    }
    if (search) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [search, saved])

  if (!me) {
    return (
      <p className={styles.status}>
        내 취향 정보를 찾지 못했어요. <Link to="/profile">프로필</Link>에서 확인해 주세요.
      </p>
    )
  }

  function handleAiResult(conditions) {
    const filters = filtersFromConditions(conditions, catalog)
    // 필터 창으로 바꾸면 AI가 고른 조건을 이어서 다듬을 수 있다.
    setDraft(filters)
    setSearch({
      filters,
      summary: conditions.summary || describeFilters(filters),
      byAi: true,
      at: Date.now(),
    })
  }

  return (
    <>
      {/* 필터로 갈 때는 오른쪽에서, AI로 돌아갈 때는 왼쪽에서 들어온다. */}
      <div className={styles.flipStage}>
        <div
          key={mode}
          className={
            flipped ? (mode === 'filter' ? styles.flipForward : styles.flipBackward) : undefined
          }
        >
          {mode === 'ai' ? (
            <AiPanel onResult={handleAiResult} />
          ) : (
            <FilterPanel
              others={others}
              catalog={catalog}
              filters={draft}
              count={draftCount}
              onChange={setDraft}
              onSearch={() =>
                setSearch({
                  filters: draft,
                  summary: describeFilters(draft),
                  byAi: false,
                  at: Date.now(),
                })
              }
            />
          )}
        </div>
      </div>
      {search && (
        <Results
          ref={resultsRef}
          search={search}
          results={results}
          onEdit={() => {
            setMode('filter')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}
    </>
  )
}

function AiPanel({ onResult }) {
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [error, setError] = useState(null)

  async function ask(text) {
    const trimmed = text.trim()
    if (!trimmed || isAsking) return
    setIsAsking(true)
    setError(null)
    try {
      onResult(await askAiSearch(trimmed))
    } catch (caught) {
      setError(aiSearchErrorMessage(caught))
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <section className={styles.ai} aria-labelledby="ai-title">
      <h2 id="ai-title" className={styles.panelTitle}>
        <span className={styles.aiBadge}>AI</span> 어떤 게이머를 찾으세요?
      </h2>
      <form
        className={styles.aiForm}
        onSubmit={(event) => {
          event.preventDefault()
          ask(question)
        }}
      >
        <input
          className={styles.aiInput}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={AI_QUESTION_MAX_LENGTH}
          placeholder="예: 평일 밤에 롤 즐겜할 사람"
          aria-label="찾는 게이머 설명"
          disabled={isAsking}
        />
        <button type="submit" className={styles.aiButton} disabled={isAsking || !question.trim()}>
          {isAsking ? '찾는 중…' : '찾기'}
        </button>
      </form>
      <div className={styles.examples}>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className={styles.example}
            disabled={isAsking}
            onClick={() => {
              setQuestion(example)
              ask(example)
            }}
          >
            {example}
          </button>
        ))}
      </div>
      {isAsking && (
        <p className={styles.aiStatus} role="status">
          AI가 조건을 정리하고 있어요
        </p>
      )}
      {error && (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

const VISIBLE_OPTIONS = 6
const MAX_INPUT_LENGTH = 40

function FilterPanel({ others, catalog, filters, count, onChange, onSearch }) {
  // 직접 입력한 이름은 이미 골랐더라도 다시 끄지 않고 켜 둔다.
  const addName = (field, name) =>
    onChange((prev) => {
      const [key, label] = filterEntry(field, name, catalog)
      const next = new Map(prev[field])
      next.set(key, label)
      return { ...prev, [field]: next }
    })

  const toggleKey = (field, key, name) =>
    onChange((prev) => {
      const next = new Map(prev[field])
      if (next.has(key)) next.delete(key)
      else next.set(key, name)
      return { ...prev, [field]: next }
    })

  const toggleDay = (day) =>
    onChange((prev) => {
      const days = new Set(prev.days)
      if (days.has(day)) days.delete(day)
      else days.add(day)
      return { ...prev, days }
    })

  const togglePreset = (preset) =>
    onChange((prev) => {
      const range = presetHours(preset)
      const allOn = range.every((hour) => prev.hours.has(hour))
      const hours = new Set(prev.hours)
      for (const hour of range) {
        if (allOn) hours.delete(hour)
        else hours.add(hour)
      }
      return { ...prev, hours }
    })

  const isEmpty = isEmptyFilters(filters)

  return (
    <section className={styles.filters} aria-labelledby="filters-title">
      <h2 id="filters-title" className={styles.panelTitle}>
        어떤 조건으로 찾을까요?
      </h2>

      <OptionGroup
        label="게임"
        options={popularOptions(others, 'games')}
        selected={filters.games}
        onToggle={(key, name) => toggleKey('games', key, name)}
        onAdd={(name) => addName('games', name)}
        placeholder="예: 테일즈런너"
      />
      <OptionGroup
        label="장르"
        options={popularOptions(others, 'genres')}
        selected={filters.genres}
        onToggle={(key, name) => toggleKey('genres', key, name)}
        onAdd={(name) => addName('genres', name)}
        placeholder="예: 리듬게임"
      />
      <OptionGroup
        label="스타일 · 콘텐츠"
        options={popularOptions(others, 'tags')}
        selected={filters.tags}
        onToggle={(key, name) => toggleKey('tags', key, name)}
        onAdd={(name) => addName('tags', name)}
        placeholder="예: 마이크 없이, 새벽반"
      />

      <div className={styles.group}>
        <p className={styles.groupLabel}>요일</p>
        <div className={styles.chips}>
          {DAYS.map((day) => (
            <Chip
              key={day.key}
              selected={filters.days.has(day.key)}
              onClick={() => toggleDay(day.key)}
            >
              {day.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>시간대</p>
        <div className={styles.chips}>
          {TIME_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              selected={presetHours(preset).every((hour) => filters.hours.has(hour))}
              onClick={() => togglePreset(preset)}
            >
              {preset.label}
            </Chip>
          ))}
        </div>
        {filters.hours.size > 0 && (
          <p className={styles.hourNote}>{describeHourSet(filters.hours)}</p>
        )}
      </div>

      <div className={styles.filterActions}>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => onChange(emptyFilters())}
          disabled={isEmpty}
        >
          초기화
        </button>
        <button
          type="button"
          className={styles.searchButton}
          onClick={onSearch}
          disabled={isEmpty || count === 0}
        >
          {isEmpty
            ? '조건을 골라 주세요'
            : count === 0
              ? '맞는 게이머가 없어요'
              : `${count}명 찾기`}
        </button>
      </div>
    </section>
  )
}

/** {20, 21, 22, 23} → "20시~24시" 처럼 이어진 구간으로 보여 준다. */
function describeHourSet(hours) {
  const sorted = [...hours].sort((a, b) => a - b)
  const ranges = []
  for (const hour of sorted) {
    const last = ranges.at(-1)
    if (last && last[1] === hour) last[1] = hour + 1
    else ranges.push([hour, hour + 1])
  }
  return ranges.map(([start, end]) => `${start}시~${end}시`).join(', ')
}

/** 필터로 검색했을 때 결과 위에 보여 줄 조건 요약 */
function describeFilters(filters) {
  const parts = [...filters.games.values(), ...filters.genres.values(), ...filters.tags.values()]
  if (filters.days.size > 0) {
    parts.push(
      `${[...filters.days]
        .sort((a, b) => a - b)
        .map(dayLabel)
        .join('·')}요일`,
    )
  }
  if (filters.hours.size > 0) parts.push(describeHourSet(filters.hours))
  return parts.join(' · ')
}

/**
 * 많이 고른 항목 몇 개와 [+ 직접 입력] 칩. 목록에 없는 것은 직접 입력해서 고른다.
 * 고른 항목은 인기 목록에 없어도(AI나 직접 입력으로 고른 것) 뒤에 이어서 보여 준다.
 */
function OptionGroup({ label, options, selected, onToggle, onAdd, placeholder }) {
  const [isAdding, setIsAdding] = useState(false)
  const popular = options.slice(0, VISIBLE_OPTIONS)
  const popularKeys = new Set(popular.map((option) => option.key))
  const extra = [...selected]
    .filter(([key]) => !popularKeys.has(key))
    .map(([key, name]) => ({ key, name }))

  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>{label}</p>
      <div className={styles.chips}>
        {[...popular, ...extra].map((option) => (
          <Chip
            key={option.key}
            selected={selected.has(option.key)}
            onClick={() => onToggle(option.key, option.name)}
          >
            {option.name}
          </Chip>
        ))}
        <button type="button" className={styles.addChip} onClick={() => setIsAdding(true)}>
          + 직접 입력
        </button>
      </div>
      {isAdding && (
        <AddDialog
          title={`${label} 직접 입력`}
          description="목록에 없으면 단어로 적어 주세요. 띄어쓰기·대소문자가 달라도 찾아요."
          placeholder={placeholder}
          maxLength={MAX_INPUT_LENGTH}
          onSave={(name) => {
            onAdd(name)
            setIsAdding(false)
          }}
          onClose={() => setIsAdding(false)}
        />
      )}
    </div>
  )
}

function Results({ ref, search, results, onEdit }) {
  const navigate = useNavigate()
  const [startingId, setStartingId] = useState(null)
  const [chatError, setChatError] = useState(null)

  async function handleChat(otherId) {
    setStartingId(otherId)
    setChatError(null)
    try {
      navigate(`/chat/${await startDirectChat(otherId)}`)
    } catch {
      setChatError('대화방을 열지 못했어요. 잠시 후 다시 시도해 주세요.')
      setStartingId(null)
    }
  }

  return (
    <section ref={ref} className={styles.results} aria-labelledby="results-title">
      <div className={styles.resultsHeader}>
        <h2 id="results-title" className={styles.resultsTitle}>
          찾은 게이머 {results.length}명
        </h2>
        <p className={styles.resultsHint}>궁합 높은 순</p>
      </div>
      <div className={styles.searchSummary}>
        <p>
          {search.byAi && <span aria-hidden="true">✨ </span>}
          {search.summary}
        </p>
        <button type="button" className={styles.linkButton} onClick={onEdit}>
          조건 바꾸기
        </button>
      </div>
      {chatError && (
        <p className={styles.alert} role="alert">
          {chatError}
        </p>
      )}
      {results.length === 0 ? (
        <div className={styles.empty}>
          <p>조건에 맞는 게이머가 없어요. 조건을 몇 개 빼 보세요.</p>
          <Button variant="secondary" onClick={onEdit}>
            조건 바꾸기
          </Button>
        </div>
      ) : (
        <ResultPages
          key={search.at}
          searchAt={search.at}
          results={results}
          renderCard={({ player, match }) => (
            <MatchCard
              player={player}
              match={match}
              compact
              onChat={() => handleChat(player.id)}
              isStartingChat={startingId === player.id}
              profileTo={`/users/${player.id}`}
            />
          )}
        />
      )}
    </section>
  )
}
