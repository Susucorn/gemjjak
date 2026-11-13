/** 첫 화면에 바로 보여 줄 인기 게임 수. 나머지는 검색하거나 직접 입력한다. */
export const POPULAR_GAME_COUNT = 9
export const MAX_CUSTOM_GAMES = 10
export const MAX_GAME_NAME_LENGTH = 40

/**
 * 띄어쓰기·대소문자·기호를 무시하고 비교한다. "롤 체" → "롤체", "LoL" → "lol"
 * DB 함수 public.normalize_game_name과 같은 규칙이다.
 */
export function normalize(text) {
  return text.toLowerCase().replace(/[\s:·\-_.,!?'"]/g, '')
}

export function matchesQuery(game, query) {
  const q = normalize(query)
  if (!q) return true
  return [game.name, ...game.aliases].some((label) => normalize(label).includes(q))
}

/** 이름이나 별명이 검색어와 정확히 같은 게임 */
export function findExactGame(games, query) {
  const q = normalize(query)
  if (!q) return null
  return games.find((game) => [game.name, ...game.aliases].some((label) => normalize(label) === q))
}
