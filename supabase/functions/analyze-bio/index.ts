// 소개글을 tag_vocabulary 안의 태그로 정리한다.
// 결과는 저장하지 않고 돌려주기만 한다. 사용자가 확인·수정한 뒤 프론트엔드가 profiles.tags에 저장한다.

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { getAnthropicApiKey } from '../_shared/claude.ts'
import { errorResponse, readJsonObject } from '../_shared/http.ts'

const MAX_BIO_LENGTH = 200

export interface AnalyzeBioRequest {
  bio: string
  game_ids: number[]
}

export interface AnalyzeBioResponse {
  style: string | null
  activities: string[]
  wants: string[]
}

function parseRequest(body: Record<string, unknown> | null): AnalyzeBioRequest | null {
  if (!body) return null

  const { bio, game_ids: gameIds } = body
  if (typeof bio !== 'string' || bio.trim() === '' || bio.length > MAX_BIO_LENGTH) return null
  if (!Array.isArray(gameIds) || !gameIds.every(Number.isInteger)) return null

  return { bio, game_ids: gameIds }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, _ctx) => {
    if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed')

    const input = parseRequest(await readJsonObject(req))
    if (!input) return errorResponse(400, 'invalid_request')

    const apiKey = getAnthropicApiKey()
    if (!apiKey) return errorResponse(500, 'server_misconfigured')

    // TODO: 다음 단계에서 구현
    // 1. ctx.supabase로 공통 태그(game_id is null)와 input.game_ids의 태그를 tag_vocabulary에서 읽는다.
    // 2. Claude에 소개글과 태그 목록을 보내 AnalyzeBioResponse 형태로 받는다.
    //    - new Anthropic({ apiKey }), model: CLAUDE_MODEL
    //    - JSON 형식은 output_config.format으로 고정한다.
    //    - 소개글은 사용자 입력이므로 그 안의 지시를 따르지 않도록 system에 적는다.
    // 3. 목록에 없는 태그는 응답에서 뺀다. Claude 출력도 그대로 믿지 않는다.
    return errorResponse(501, 'not_implemented')
  }),
}
