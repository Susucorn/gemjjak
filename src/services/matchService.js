import { buildPlayer } from '../lib/compatibility'
import { supabase } from '../lib/supabaseClient'

// 궁합 점수는 기획서대로 브라우저에서 계산한다. 그래서 온보딩을 마친 사용자의 취향을 한 번에 읽어 온다.
// 수업 프로젝트 규모(수백 명)를 가정한다. 사용자가 많아지면 DB 함수로 옮겨 상위 N명만 받아야 한다.
const MAX_PLAYERS = 500

async function selectAll(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

function groupByUser(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.user_id)) map.set(row.user_id, [])
    map.get(row.user_id).push(row)
  }
  return map
}

/**
 * 나와 다른 사용자들을 궁합 계산용 모양으로 돌려준다. { me, others, catalog }
 * onlyIds를 주면 그 사용자들만 읽는다(채팅방 상단 궁합처럼 두 사람만 필요할 때).
 */
export async function fetchPlayers(myId, onlyIds = null) {
  const byUser = (query) => (onlyIds ? query.in('user_id', onlyIds) : query)
  let profileQuery = supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio, tags')
    .eq('onboarded', true)
    .order('created_at', { ascending: false })
    .limit(MAX_PLAYERS)
  if (onlyIds) profileQuery = profileQuery.in('id', onlyIds)

  const [
    profiles,
    games,
    genres,
    userGames,
    customGames,
    userGenres,
    customGenres,
    customTags,
    slots,
  ] = await Promise.all([
    selectAll(profileQuery),
    selectAll(supabase.from('games').select('id, name, genre_id')),
    selectAll(supabase.from('genres').select('id, name')),
    selectAll(byUser(supabase.from('user_games').select('user_id, game_id'))),
    selectAll(byUser(supabase.from('user_custom_games').select('user_id, name'))),
    selectAll(byUser(supabase.from('user_genres').select('user_id, genre_id'))),
    selectAll(byUser(supabase.from('user_custom_genres').select('user_id, name'))),
    selectAll(byUser(supabase.from('user_custom_tags').select('user_id, category, name'))),
    selectAll(
      byUser(supabase.from('availability').select('user_id, weekday, start_hour, end_hour')),
    ),
  ])

  const catalog = {
    gameById: new Map(games.map((game) => [game.id, game])),
    genreById: new Map(genres.map((genre) => [genre.id, genre])),
  }
  const grouped = {
    games: groupByUser(userGames),
    customGames: groupByUser(customGames),
    genres: groupByUser(userGenres),
    customGenres: groupByUser(customGenres),
    customTags: groupByUser(customTags),
    slots: groupByUser(slots),
  }
  const rowsOf = (key, id) => grouped[key].get(id) ?? []

  const players = profiles.map((profile) =>
    buildPlayer(
      {
        profile,
        gameIds: rowsOf('games', profile.id).map((row) => row.game_id),
        customGames: rowsOf('customGames', profile.id).map((row) => row.name),
        genreIds: rowsOf('genres', profile.id).map((row) => row.genre_id),
        customGenres: rowsOf('customGenres', profile.id).map((row) => row.name),
        customTags: rowsOf('customTags', profile.id),
        slots: rowsOf('slots', profile.id),
      },
      catalog,
    ),
  )

  return {
    me: players.find((player) => player.id === myId) ?? null,
    others: players.filter((player) => player.id !== myId),
    catalog,
  }
}
