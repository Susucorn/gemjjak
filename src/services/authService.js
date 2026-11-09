import { supabase } from '../lib/supabaseClient'

/**
 * 디스코드 로그인 페이지로 이동한다. 성공하면 브라우저가 이 앱의 /login으로 돌아오고,
 * supabase-js가 주소의 인증 코드를 세션으로 바꾼다.
 * 돌아올 주소는 Supabase 대시보드 Authentication > URL Configuration의 Redirect URLs에 있어야 한다.
 */
export async function signInWithDiscord() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
