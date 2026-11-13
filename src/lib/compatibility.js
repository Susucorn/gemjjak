// 궁합 점수 계산. 기획서 기준: 공통 게임 40% + 접속 시간 겹침 35% + 플레이 스타일 25%
//
// 각 항목은 0~1 사이 비율로, 겹친 개수 / √(내 개수 × 상대 개수)다(오치아이 계수).
// 작은 쪽 개수로만 나누면 월요일 3시간만 접속하는 사람도 시간 100%가 되어 점수가 부풀고,
// 합집합으로 나누면 게임을 많이 고른 사람이 손해를 본다. 그 중간이다.
// 같은 게임이 하나도 없으면 같은 장르 비율의 절반을 게임 점수로 준다.

import { DAYS, describeHours } from '../pages/onboarding/hours'
import { normalize } from '../pages/onboarding/gameSearch'

export const WEIGHTS = { game: 0.4, time: 0.35, style: 0.25 }
const GENRE_ONLY_CREDIT = 0.5

/**
 * DB에서 읽은 한 사용자의 취향을 비교하기 쉬운 모양으로 바꾼다.
 * 각 Map은 비교용 키 → 화면에 보여 줄 이름이다.
 *   games  'g:<games.id>' 또는 'c:<정규화한 이름>'
 *   genres 'g:<genres.id>' 또는 'c:<정규화한 이름>'. 고른 게임의 장르도 포함한다.
 *   tags   't:<정규화한 이름>'. 목록 태그와 직접 입력 태그를 같은 기준으로 비교한다.
 * hours는 요일·시각 칸 번호(weekday * 24 + hour)의 Set이다.
 */
export function buildPlayer(
  { profile, gameIds, customGames, genreIds, customGenres, customTags, slots },
  catalog,
) {
  const games = new Map()
  const genres = new Map()
  const tags = new Map()
  const hours = new Set()

  for (const id of gameIds) {
    const game = catalog.gameById.get(id)
    if (!game) continue
    games.set(`g:${id}`, game.name)
    if (game.genre_id && catalog.genreById.has(game.genre_id)) {
      genres.set(`g:${game.genre_id}`, catalog.genreById.get(game.genre_id).name)
    }
  }
  for (const name of customGames) games.set(`c:${normalize(name)}`, name)

  for (const id of genreIds) {
    const genre = catalog.genreById.get(id)
    if (genre) genres.set(`g:${id}`, genre.name)
  }
  for (const name of customGenres) genres.set(`c:${normalize(name)}`, name)

  for (const tag of profile.tags ?? []) tags.set(`t:${normalize(tag)}`, tag)
  for (const { name } of customTags) tags.set(`t:${normalize(name)}`, name)

  for (const slot of slots) {
    for (let hour = slot.start_hour; hour < slot.end_hour; hour += 1) {
      hours.add(slot.weekday * 24 + hour)
    }
  }

  return {
    id: profile.id,
    nickname: profile.nickname,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    games,
    genres,
    tags,
    hours,
  }
}

function common(a, b) {
  return [...a.keys()].filter((key) => b.has(key))
}

function ratio(count, a, b) {
  return a === 0 || b === 0 ? 0 : Math.min(1, count / Math.sqrt(a * b))
}

/**
 * 두 사람의 궁합을 계산한다.
 * score는 0~100 정수, parts는 항목별 0~1 비율, reasons는 화면에 보여 줄 추천 근거 문장이다.
 */
export function compatibility(me, other) {
  const commonGames = common(me.games, other.games)
  const commonGenres = common(me.genres, other.genres)
  const commonTags = common(me.tags, other.tags)
  const overlap = [...me.hours].filter((cell) => other.hours.has(cell))

  const gameRatio = ratio(commonGames.length, me.games.size, other.games.size)
  const genreRatio = ratio(commonGenres.length, me.genres.size, other.genres.size)
  const parts = {
    game: commonGames.length > 0 ? gameRatio : genreRatio * GENRE_ONLY_CREDIT,
    time: ratio(overlap.length, me.hours.size, other.hours.size),
    style: ratio(commonTags.length, me.tags.size, other.tags.size),
  }
  const score = Math.round(
    100 * (WEIGHTS.game * parts.game + WEIGHTS.time * parts.time + WEIGHTS.style * parts.style),
  )

  return {
    score,
    parts,
    commonGames: commonGames.map((key) => other.games.get(key)),
    commonGenres: commonGenres.map((key) => other.genres.get(key)),
    commonTags: commonTags.map((key) => other.tags.get(key)),
    overlapHours: overlap.length,
    reasons: buildReasons({
      commonGames: commonGames.map((key) => other.games.get(key)),
      commonGenres: commonGenres.map((key) => other.genres.get(key)),
      commonTags: commonTags.map((key) => other.tags.get(key)),
      overlap,
    }),
  }
}

function listNames(names, max = 2) {
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} 외 ${names.length - max}개` : shown
}

/**
 * 겹치는 시간을 한 문장으로 줄인다.
 * 요일마다 겹치는 시간대를 구해 가장 많은 요일에 나오는 시간대를 고른다.
 * 예: "월·수·금 20시–23시가 겹쳐요", 시간대가 제각각이면 "주 9시간 겹쳐요"
 */
export function describeOverlap(overlap) {
  if (overlap.length === 0) return null

  const byDay = new Map()
  for (const cell of overlap) {
    const day = Math.floor(cell / 24)
    if (!byDay.has(day)) byDay.set(day, new Set())
    byDay.get(day).add(cell % 24)
  }

  const daysByRange = new Map()
  for (const [day, hours] of byDay) {
    const range = describeHours(hours)
    if (!daysByRange.has(range)) daysByRange.set(range, [])
    daysByRange.get(range).push(day)
  }
  const [range, days] = [...daysByRange].sort((a, b) => b[1].length - a[1].length)[0]

  if (days.length === 1 && byDay.size > 2) return `주 ${overlap.length}시간 겹쳐요`
  const dayNames = DAYS.filter((item) => days.includes(item.key))
    .map((item) => item.label)
    .join('·')
  return `${dayNames} ${range}가 겹쳐요`
}

function buildReasons({ commonGames, commonGenres, commonTags, overlap }) {
  const reasons = []
  if (commonGames.length > 0) reasons.push(`공통 게임 ${listNames(commonGames)}`)
  else if (commonGenres.length > 0) reasons.push(`같은 장르 ${listNames(commonGenres)}`)

  const time = describeOverlap(overlap)
  if (time) reasons.push(time)

  if (commonTags.length > 0) reasons.push(`둘 다 ${listNames(commonTags, 2)}`)
  return reasons
}

/**
 * 홈 추천 목록.
 * today: 궁합 높은 순 상위 5명. 같은 점수는 날짜마다 순서를 바꿔 매일 조금씩 다르게 보여 준다.
 * similar: today에 없는 사람 중 스타일·장르가 비슷한 순 6명
 */
export function rankPlayers(me, others, today = new Date()) {
  const daySeed = Number(today.toISOString().slice(0, 10).replaceAll('-', ''))
  const tieBreak = (id) => {
    let hash = daySeed
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 1000003
    return hash
  }

  const scored = others
    .filter((other) => other.id !== me.id)
    .map((other) => ({ player: other, match: compatibility(me, other) }))

  const todayPicks = scored
    .filter((item) => item.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score || tieBreak(a.player.id) - tieBreak(b.player.id))
    .slice(0, 5)

  const picked = new Set(todayPicks.map((item) => item.player.id))
  // 같은 장르 2개면 장르 쪽은 꽉 찬 것으로 본다.
  const similarity = ({ match }) => match.parts.style + Math.min(1, match.commonGenres.length / 2)
  const similar = scored
    .filter((item) => !picked.has(item.player.id) && similarity(item) > 0)
    .sort((a, b) => similarity(b) - similarity(a) || b.match.score - a.match.score)
    .slice(0, 6)

  return { today: todayPicks, similar }
}
