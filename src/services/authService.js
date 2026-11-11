import { supabase } from '../lib/supabaseClient'

/** provider: 'discord' | 'google'. 로그인 후 /login으로 돌아오면 가드가 원래 화면으로 보낸다. */
export async function signInWithProvider(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** 디스코드로 가입한 계정인지. 구글 계정은 디스코드 표시를 하지 않는다. */
export function isDiscordUser(user) {
  return (
    user?.app_metadata?.provider === 'discord' ||
    Boolean(user?.app_metadata?.providers?.includes('discord'))
  )
}
