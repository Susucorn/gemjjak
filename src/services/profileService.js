import { supabase } from '../lib/supabaseClient'

export const NICKNAME_MAX_LENGTH = 20
export const BIO_MAX_LENGTH = 150

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio, tags, onboarded')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** 빈 소개는 null로 저장한다. */
export async function updateProfileInfo(userId, { nickname, bio }) {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname: nickname.trim(), bio: bio.trim() || null })
    .eq('id', userId)

  if (error) throw error
}

/** 구글 가입자가 온보딩에서 닉네임을 정할 때 쓴다. */
export async function updateNickname(userId, nickname) {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname: nickname.trim() })
    .eq('id', userId)

  if (error) throw error
}
