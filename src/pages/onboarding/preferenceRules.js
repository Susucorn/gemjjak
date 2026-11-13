import { DAYS, emptyHours, totalHours } from './hours'

// 온보딩과 프로필 수정이 함께 쓰는 취향 입력 규칙.
//
// prefs 모양
//   { gameIds: Set, customGames: string[], genreIds: Set, customGenres: string[],
//     tags: Set, customTags: { style: string[], activity: string[], want: string[] },
//     hours: { 1: Set, ..., 7: Set } }  (요일 ISO 번호 → 접속 시각 0~23)
// tags는 tag_vocabulary에서 고른 태그, customTags는 분류별로 직접 입력한 태그다.

export const MAX_CUSTOM_GENRES = 5
/** 분류(스타일·콘텐츠·찾는 사람)마다 직접 입력할 수 있는 태그 수 */
export const MAX_CUSTOM_TAGS = 5
export const MAX_LABEL_LENGTH = 20
export const TAG_CATEGORIES = ['style', 'activity', 'want']

export const PREFERENCE_STEPS = [
  {
    key: 'games',
    title: '어떤 게임을 하세요?',
    editTitle: '내가 하는 게임',
    description: '하는 게임을 모두 골라 주세요. 목록에 없으면 이름을 직접 입력하면 돼요.',
  },
  {
    key: 'style',
    title: '어떻게 플레이하세요?',
    editTitle: '플레이 스타일',
    description: '장르와 플레이 스타일이 맞는 사람일수록 궁합 점수가 높아져요.',
  },
  {
    key: 'time',
    title: '주로 언제 접속하세요?',
    editTitle: '접속 시간',
    description: '요일마다 접속하는 시간을 골라 주세요. 접속 시간이 겹치는 사람을 추천해요.',
  },
]

export function emptyPreferences() {
  return {
    gameIds: new Set(),
    customGames: [],
    genreIds: new Set(),
    customGenres: [],
    tags: new Set(),
    customTags: { style: [], activity: [], want: [] },
    hours: emptyHours(),
  }
}

export function toggleInSet(set, value) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** 단계별로 아직 채우지 않은 필수 항목 안내. null이면 통과다. */
export function stepRequirement(step, prefs, vocabulary) {
  if (step === 0) {
    return prefs.gameIds.size + prefs.customGames.length === 0
      ? '게임을 1개 이상 골라 주세요'
      : null
  }
  if (step === 1) {
    if (prefs.genreIds.size + prefs.customGenres.length === 0) {
      return '좋아하는 장르를 1개 이상 골라 주세요'
    }
    const hasStyleTag =
      vocabulary.some((item) => item.category === 'style' && prefs.tags.has(item.tag)) ||
      prefs.customTags.style.length > 0
    return hasStyleTag ? null : '플레이 스타일을 1개 이상 골라 주세요'
  }
  return totalHours(prefs.hours) === 0 ? '접속 시간을 1칸 이상 골라 주세요' : null
}

/** 게임 선택을 바꾸면 빠진 게임의 콘텐츠 태그가 남아 있을 수 있어 저장 직전에 걸러 낸다. */
export function tagsToSave(prefs, vocabulary) {
  const validTags = new Set(
    vocabulary
      .filter((item) => item.category !== 'activity' || prefs.gameIds.has(item.game_id))
      .map((item) => item.tag),
  )
  return [...prefs.tags].filter((tag) => validTags.has(tag))
}

/** saveMyPreferences에 넘길 값 */
export function toSavePayload(prefs, vocabulary) {
  return {
    gameIds: [...prefs.gameIds],
    customGames: prefs.customGames,
    genreIds: [...prefs.genreIds],
    customGenres: prefs.customGenres,
    tags: tagsToSave(prefs, vocabulary),
    customTags: prefs.customTags,
    hours: Object.fromEntries(DAYS.map((day) => [day.key, [...prefs.hours[day.key]]])),
  }
}

/** 고른 게임의 장르. 온보딩에서 장르를 미리 골라 둘 때 쓴다. */
export function genresOfGames(games, gameIds) {
  return new Set(
    games.filter((game) => gameIds.has(game.id) && game.genre_id).map((game) => game.genre_id),
  )
}
