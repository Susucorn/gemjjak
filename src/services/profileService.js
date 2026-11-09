import { supabase } from '../lib/supabaseClient'

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, bio, tags, onboarded')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}
