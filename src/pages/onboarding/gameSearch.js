export const PLATFORMS = [
  { key: 'all', label: '전체' },
  { key: 'pc', label: 'PC' },
  { key: 'mobile', label: '모바일' },
  { key: 'console', label: '콘솔' },
]

/** 띄어쓰기·대소문자·기호를 무시하고 비교한다. "롤 체" → "롤체", "LoL" → "lol" */
export function normalize(text) {
  return text.toLowerCase().replace(/[\s:·\-_.,!?'"]/g, '')
}

export function matchesQuery(game, query) {
  const q = normalize(query)
  if (!q) return true
  return [game.name, ...game.aliases].some((label) => normalize(label).includes(q))
}

export function matchesPlatform(game, platform) {
  return platform === 'all' || game.platforms.includes(platform)
}
