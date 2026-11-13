import { supabase } from '../lib/supabaseClient'
import { emptyHours } from '../pages/onboarding/hours'

export async function fetchGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, genre_id, aliases')
    .order('sort_order')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchGenres() {
  const { data, error } = await supabase.from('genres').select('id, name').order('sort_order')
  if (error) throw error
  return data
}

/** category: 'style' | 'activity' | 'want'. activity 태그는 game_id로 게임에 묶여 있다. */
export async function fetchTagVocabulary() {
  const { data, error } = await supabase
    .from('tag_vocabulary')
    .select('id, tag, category, game_id')
    .order('id')
  if (error) throw error
  return data
}

/** 고를 수 있는 게임·장르·태그 목록 */
export async function fetchPreferenceOptions() {
  const [games, genres, vocabulary] = await Promise.all([
    fetchGames(),
    fetchGenres(),
    fetchTagVocabulary(),
  ])
  return { games, genres, vocabulary }
}

/**
 * 내가 저장한 취향을 온보딩 입력과 같은 모양으로 돌려준다.
 * 접속 시간은 요일별 { 1: Set, ..., 7: Set }으로 돌려준다.
 */
export async function fetchMyPreferences(userId) {
  const [games, genres, customGames, customGenres, customTags, availability, profile] =
    await Promise.all([
      supabase.from('user_games').select('game_id').eq('user_id', userId),
      supabase.from('user_genres').select('genre_id').eq('user_id', userId),
      supabase.from('user_custom_games').select('name').eq('user_id', userId).order('created_at'),
      supabase.from('user_custom_genres').select('name').eq('user_id', userId).order('created_at'),
      supabase
        .from('user_custom_tags')
        .select('category, name')
        .eq('user_id', userId)
        .order('created_at'),
      supabase.from('availability').select('weekday, start_hour, end_hour').eq('user_id', userId),
      supabase.from('profiles').select('tags').eq('id', userId).single(),
    ])
  const results = [games, genres, customGames, customGenres, customTags, availability, profile]
  for (const result of results) {
    if (result.error) throw result.error
  }

  const hours = emptyHours()
  for (const slot of availability.data) {
    for (let hour = slot.start_hour; hour < slot.end_hour; hour += 1) hours[slot.weekday].add(hour)
  }

  return {
    gameIds: new Set(games.data.map((row) => row.game_id)),
    customGames: customGames.data.map((row) => row.name),
    genreIds: new Set(genres.data.map((row) => row.genre_id)),
    customGenres: customGenres.data.map((row) => row.name),
    tags: new Set(profile.data.tags),
    customTags: {
      style: customTags.data.filter((row) => row.category === 'style').map((row) => row.name),
      activity: customTags.data.filter((row) => row.category === 'activity').map((row) => row.name),
      want: customTags.data.filter((row) => row.category === 'want').map((row) => row.name),
    },
    hours,
  }
}

/**
 * 게임·장르·태그·접속 시간을 한 번에 저장하고 온보딩을 완료 처리한다.
 * customGames·customGenres는 목록에 없어 직접 입력한 이름이다. 기존 것과 같으면 DB가 그것으로 바꾼다.
 * customTags는 분류별로 직접 입력한 태그 { style: [], activity: [], want: [] }다.
 * hours는 요일(1=월 ~ 7=일)별 0~23 시각 배열 { 1: [20, 21], ... }이다. 7은 7시~8시를 뜻한다.
 */
export async function saveMyPreferences({
  gameIds,
  customGames,
  genreIds,
  customGenres,
  tags,
  customTags,
  hours,
}) {
  const { error } = await supabase.rpc('save_my_preferences', {
    p_game_ids: gameIds,
    p_custom_games: customGames,
    p_genre_ids: genreIds,
    p_custom_genres: customGenres,
    p_tags: tags,
    p_custom_tags: customTags,
    p_hours: hours,
  })
  if (error) throw error
}

// save_my_preferences가 내는 오류 메시지(영문) → 사용자에게 보여 줄 문장
const SAVE_ERRORS = [
  ['select at least one game', '게임을 1개 이상 골라 주세요.'],
  ['select at least one genre', '좋아하는 장르를 1개 이상 골라 주세요.'],
  ['select at least one style tag', '플레이 스타일을 1개 이상 골라 주세요.'],
  ['select at least one hour', '접속 시간을 1칸 이상 골라 주세요.'],
  ['too many custom', '직접 추가한 항목이 너무 많아요. 몇 개를 빼 주세요.'],
  ['too long', '직접 추가한 이름이 너무 길어요.'],
  ['login required', '로그인이 끊겼어요. 다시 로그인해 주세요.'],
]

export function preferenceErrorMessage(error) {
  const message = error?.message ?? ''
  const match = SAVE_ERRORS.find(([key]) => message.includes(key))
  return match ? match[1] : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}
