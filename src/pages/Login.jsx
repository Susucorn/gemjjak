import { isSupabaseConfigured } from '../lib/supabaseClient'

export function Login() {
  return (
    <>
      <h1>로그인</h1>
      {!isSupabaseConfigured && (
        <p role="alert">
          Supabase 환경 변수가 없습니다. .env.example을 복사해 .env를 만들고 값을 채워 주세요.
        </p>
      )}
    </>
  )
}
