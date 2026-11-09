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

/**
 * 게임·장르·태그·접속 시간을 한 번에 저장하고 온보딩을 완료 처리한다.
 * requestedGames는 목록에 없어 추가를 요청한 게임 이름이다.
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
