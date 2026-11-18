import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

export const AI_QUESTION_MAX_LENGTH = 200

/**
 * 문장을 탐색 조건으로 바꾼다. Claude는 Edge Function(ai-search)에서만 호출한다.
 * 반환: { conditions: { games, genres, tags, weekdays, hours, summary }, remaining }
 */
export async function askAiSearch(question) {
  const { data, error } = await supabase.functions.invoke('ai-search', {
    body: { question },
  })
  if (error) {
    let code = 'unknown'
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      code = body?.error ?? 'unknown'
      // 원인을 찾을 수 있게 개발자 도구 콘솔에 남긴다.
      if (body?.detail) console.warn('[ai-search]', code, body.detail)
    }
    throw Object.assign(new Error(code), { code })
  }
  return data
}

/** 오늘 남은 AI 검색 횟수 */
export async function fetchAiSearchRemaining() {
  const { data, error } = await supabase.rpc('ai_search_remaining')
  if (error) throw error
  return data
}

export const AI_SEARCH_DAILY_LIMIT = 2

export function aiSearchErrorMessage(error) {
  switch (error?.code) {
    case 'invalid_request':
      return `질문은 ${AI_QUESTION_MAX_LENGTH}자 이내로 적어 주세요.`
    case 'daily_limit':
      return '오늘 AI 검색을 모두 썼어요. 내일 다시 쓸 수 있어요. 필터로 찾아보세요.'
    case 'refused':
      return '이 질문은 도와드리기 어려워요. 찾는 게임 친구를 다르게 적어 주세요.'
    case 'server_misconfigured':
      return 'AI 검색이 아직 준비되지 않았어요. 아래 필터로 찾아 주세요.'
    default:
      return 'AI가 지금 답하지 못했어요. 잠시 후 다시 시도하거나 아래 필터로 찾아 주세요.'
  }
}
