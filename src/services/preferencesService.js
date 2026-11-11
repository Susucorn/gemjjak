import { supabase } from '../lib/supabaseClient'

export async function fetchGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id, name, genre_id, platforms, aliases')
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
 * 접속 시간은 평일(월~금)이 모두 같고 주말(토·일)이 모두 같게 저장되므로 월요일과 토요일만 읽는다.
 */
export async function fetchMyPreferences(userId) {
  const [games, genres, requests, availability, profile] = await Promise.all([
    supabase.from('user_games').select('game_id').eq('user_id', userId),
    supabase.from('user_genres').select('genre_id').eq('user_id', userId),
    supabase
      .from('game_requests')
      .select('name')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('availability')
      .select('weekday, start_hour, end_hour')
      .eq('user_id', userId)
      .in('weekday', [1, 6]),
    supabase.from('profiles').select('tags').eq('id', userId).single(),
  ])
  for (const result of [games, genres, requests, availability, profile]) {
    if (result.error) throw result.error
  }

  const hours = { weekday: new Set(), weekend: new Set() }
  for (const slot of availability.data) {
    const target = slot.weekday === 6 ? hours.weekend : hours.weekday
    for (let hour = slot.start_hour; hour < slot.end_hour; hour += 1) target.add(hour)
  }

  return {
    gameIds: new Set(games.data.map((row) => row.game_id)),
    requestedGames: requests.data.map((row) => row.name),
    genreIds: new Set(genres.data.map((row) => row.genre_id)),
    tags: new Set(profile.data.tags),
    hours,
  }
}

/**
 * 게임·장르·태그·접속 시간을 한 번에 저장하고 온보딩을 완료 처리한다.
 * requestedGames는 목록에 없어 추가를 요청한 게임 이름이다. 여기에 없는 확인 전 요청은 취소된다.
 * weekdayHours/weekendHours는 0~23 시각 배열이다. 7은 7시~8시를 뜻한다.
 */
export async function saveMyPreferences({
  gameIds,
  requestedGames,
  genreIds,
  tags,
  weekdayHours,
  weekendHours,
}) {
  const { error } = await supabase.rpc('save_my_preferences', {
    p_game_ids: gameIds,
    p_requested_games: requestedGames,
    p_genre_ids: genreIds,
    p_tags: tags,
    p_weekday_hours: weekdayHours,
    p_weekend_hours: weekendHours,
  })
  if (error) throw error
}
