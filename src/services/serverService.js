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

const SERVER_COLUMNS = 'id, name, game_id, description, invite_url, status, created_at'

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

function toRow({ name, gameId, description, inviteUrl }) {
  return {
    name: name.trim(),
    game_id: gameId,
    description: description.trim() || null,
    invite_url: inviteUrl,
  }
}

export async function createServer(userId, fields) {
  const { error } = await supabase.from('servers').insert({ ...toRow(fields), owner_id: userId })
  if (error) throw error
}

/** 초대 링크를 바꾸면 DB 트리거가 다시 '확인 중'으로 돌린다. */
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
