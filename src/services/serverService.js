import { supabase } from '../lib/supabaseClient'

export const SERVER_NAME_MAX_LENGTH = 40
export const SERVER_DESCRIPTION_MAX_LENGTH = 300

export const SERVER_STATUS_LABEL = {
  pending: '확인 중',
  approved: '공개 중',
  rejected: '반려됨',
}

const INVITE_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|(?:discord|discordapp)\.com\/invite)\/([A-Za-z0-9-]+)\/?$/i

/**
 * "discord.gg/abc", "https://discord.com/invite/abc" 등을 https://discord.gg/abc로 맞춘다.
 * 초대 코드는 대소문자를 구분하므로 그대로 둔다. 형식이 틀리면 null.
 */
export function normalizeInviteUrl(input) {
  const match = input.trim().match(INVITE_PATTERN)
  return match ? `https://discord.gg/${match[1]}` : null
}

const SERVER_COLUMNS =
  'id, name, game_ids, custom_games, description, invite_url, status, created_at'

export async function fetchMyServers(userId) {
  const { data, error } = await supabase
    .from('servers')
    .select(SERVER_COLUMNS)
    .eq('owner_id', userId)
    .order('created_at')
  if (error) throw error
  return data
}

/** 본인 서버만 보인다(RLS). 없거나 남의 서버면 null */
export async function fetchMyServer(userId, serverId) {
  const { data, error } = await supabase
    .from('servers')
    .select(SERVER_COLUMNS)
    .eq('owner_id', userId)
    .eq('id', serverId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** 서버 대표 게임은 목록 게임과 직접 입력한 게임을 합쳐 이 개수까지 고른다. */
export const MAX_SERVER_GAMES = 10

/**
 * 서버의 대표 게임 이름 목록. 목록에서 고른 게임 다음에 직접 입력한 게임이 온다.
 * 비어 있으면 "여러 게임"으로 보여 준다.
 */
export function serverGameNames(server, gameById) {
  const listed = (server.game_ids ?? []).map((id) => gameById.get(id)?.name).filter(Boolean)
  return [...listed, ...(server.custom_games ?? [])]
}

/** 목록 한 줄용: "원신, 리그 오브 레전드 외 2개", 비어 있으면 "여러 게임" */
export function gameListText(names, max = 2) {
  if (names.length === 0) return '여러 게임'
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} 외 ${names.length - max}개` : shown
}

/** gameIds: 목록에서 고른 게임 id 배열, customGames: 직접 입력한 게임 이름 배열 */
function toRow({ name, gameIds, customGames, description, inviteUrl }) {
  return {
    name: name.trim(),
    game_ids: gameIds,
    custom_games: customGames.map((game) => game.trim()).filter(Boolean),
    description: description.trim() || null,
    invite_url: inviteUrl,
  }
}

export async function createServer(userId, fields) {
  const { error } = await supabase.from('servers').insert({ ...toRow(fields), owner_id: userId })
  if (error) throw error
}

export async function updateServer(serverId, fields) {
  const { error } = await supabase.from('servers').update(toRow(fields)).eq('id', serverId)
  if (error) throw error
}

export async function deleteServer(serverId) {
  const { error } = await supabase.from('servers').delete().eq('id', serverId)
  if (error) throw error
}

/** 사용자에게 보여 줄 저장 실패 문구 */
export function serverErrorMessage(error) {
  if (error?.code === '23505') return '이미 등록된 초대 링크예요.'
  if (error?.code === '23514') return '입력한 내용을 다시 확인해 주세요.'
  return '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

/**
 * 커뮤니티 탭에 보여 줄 서버. RLS 때문에 공개(승인)된 서버와 내가 등록한 서버만 온다.
 * owner는 등록한 사용자. 관리자가 넣은 서버는 owner가 null이다.
 */
export async function fetchCommunityServers() {
  const { data, error } = await supabase
    .from('servers')
    .select(
      'id, name, game_ids, custom_games, description, invite_url, member_count, online_count, status, owner_id, owner:profiles(nickname)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

/** 다른 사용자가 등록해 공개된 서버. 승인 전 서버는 RLS 때문에 본인에게만 보인다. */
export async function fetchApprovedServersOf(ownerId) {
  const { data, error } = await supabase
    .from('servers')
    .select('id, name, game_ids, custom_games, description, invite_url, member_count, online_count')
    .eq('owner_id', ownerId)
    .eq('status', 'approved')
    .order('created_at')
  if (error) throw error
  return data
}
