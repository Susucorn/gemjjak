// Claude API 공통 설정. 이 폴더 밖(프론트엔드)에서 Claude를 직접 호출하지 않는다.

export const CLAUDE_MODEL = 'claude-opus-5-5'

/** supabase secrets set ANTHROPIC_API_KEY=... 로 등록한 키를 읽는다. */
export function getAnthropicApiKey(): string | undefined {
  return Deno.env.get('ANTHROPIC_API_KEY')
}
