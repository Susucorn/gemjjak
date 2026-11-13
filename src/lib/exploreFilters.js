// 탐색 화면 필터. 키는 buildPlayer의 Map 키와 같은 규칙이라 그대로 비교할 수 있다.
//   games 'g:<id>' | 'c:<정규화한 이름>', genres 'g:<id>' | 'c:<이름>', tags 't:<이름>'
// 같은 칸(예: 게임) 안에서는 하나라도 맞으면 되고, 칸끼리는 모두 맞아야 한다.

import { normalize } from '../pages/onboarding/gameSearch'

export function emptyFilters() {
  return { games: new Map(), genres: new Map(), tags: new Map(), days: new Set(), hours: new Set() }
}

export function isEmptyFilters(filters) {
  return Object.values(filters).every((value) => value.size === 0)
}

/** 필터에서 고른 요일·시각 칸. 요일만 고르면 하루 종일, 시각만 고르면 모든 요일로 본다. */
function filterCells({ days, hours }) {
  if (days.size === 0 && hours.size === 0) return null
  const dayList = days.size > 0 ? [...days] : [1, 2, 3, 4, 5, 6, 7]
  const hourList = hours.size > 0 ? [...hours] : [...Array(24).keys()]
  return dayList.flatMap((day) => hourList.map((hour) => day * 24 + hour))
}

const hasAny = (wanted, owned) =>
  wanted.size === 0 || [...wanted.keys()].some((key) => owned.has(key))

/** 조건에 맞으면 { timeMatch: 겹치는 시간 수 }, 아니면 null */
export function matchFilters(player, filters) {
  if (!hasAny(filters.games, player.games)) return null
  if (!hasAny(filters.genres, player.genres)) return null
  if (!hasAny(filters.tags, player.tags)) return null
  const cells = filterCells(filters)
  if (!cells) return { timeMatch: null }
  const timeMatch = cells.filter((cell) => player.hours.has(cell)).length
  return timeMatch > 0 ? { timeMatch } : null
}

/** 다른 사람들이 많이 고른 순서로 { key, name, count } 목록 */
export function popularOptions(players, field) {
  const counts = new Map()
  for (const player of players) {
    for (const [key, name] of player[field]) {
      const entry = counts.get(key) ?? { key, name, count: 0 }
      entry.count += 1
      counts.set(key, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function gameKey(name, catalog) {
  const q = normalize(name)
  for (const game of catalog.gameById.values()) {
    if ([game.name, ...(game.aliases ?? [])].some((label) => normalize(label) === q)) {
      return [`g:${game.id}`, game.name]
    }
  }
  return [`c:${q}`, name]
}

function genreKey(name, catalog) {
  const q = normalize(name)
  for (const genre of catalog.genreById.values()) {
    if (normalize(genre.name) === q) return [`g:${genre.id}`, genre.name]
  }
  return [`c:${q}`, name]
}

/** 사용자가 입력한 이름 하나를 필터 키로 바꾼다. 반환: [key, 보여 줄 이름] */
export function filterEntry(field, name, catalog) {
  if (field === 'games') return gameKey(name, catalog)
  if (field === 'genres') return genreKey(name, catalog)
  return [`t:${normalize(name)}`, name]
}

/** AI가 돌려준 조건(이름 목록)을 필터로 바꾼다. */
export function filtersFromConditions(conditions, catalog) {
  return {
    games: new Map(conditions.games.map((name) => gameKey(name, catalog))),
    genres: new Map(conditions.genres.map((name) => genreKey(name, catalog))),
    tags: new Map(conditions.tags.map((name) => [`t:${normalize(name)}`, name])),
    days: new Set(conditions.weekdays),
    hours: new Set(conditions.hours),
  }
}

// ---------------------------------------------------------------------------
// 프로필을 보고 돌아와도 조건이 남도록 sessionStorage(이 탭에서만 유지)에 저장한다.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gemjjak:explore'

function filtersToJson(filters) {
  return {
    games: [...filters.games],
    genres: [...filters.genres],
    tags: [...filters.tags],
    days: [...filters.days],
    hours: [...filters.hours],
  }
}

function filtersFromJson(json) {
  return {
    games: new Map(json.games),
    genres: new Map(json.genres),
    tags: new Map(json.tags),
    days: new Set(json.days),
    hours: new Set(json.hours),
  }
}

/** { mode, draft, search, scrollY, page, pageOf } 또는 저장된 게 없으면 null */
export function loadExploreState() {
  try {
    const json = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (!json) return null
    return {
      mode: json.mode === 'filter' ? 'filter' : 'ai',
      draft: filtersFromJson(json.draft),
      search: json.search
        ? { ...json.search, filters: filtersFromJson(json.search.filters) }
        : null,
      scrollY: Number(json.scrollY) || 0,
      page: Number(json.page) || 0,
      pageOf: json.pageOf ?? null,
    }
  } catch {
    return null
  }
}

/** 바뀐 부분만 넘겨도 된다. */
export function saveExploreState(patch) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) ?? {}
    const next = { ...prev, ...patch }
    if (patch.draft) next.draft = filtersToJson(patch.draft)
    if (patch.search)
      next.search = { ...patch.search, filters: filtersToJson(patch.search.filters) }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 저장하지 않고 넘어간다.
  }
}
