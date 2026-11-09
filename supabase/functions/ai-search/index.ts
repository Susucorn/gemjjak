// AI로 검색하기. Claude는 검색 조건만 만들고 실제 사용자 목록은 search_players가 반환한다.
// 프로필을 수정하지 않으며 Claude에게 쓰기 도구를 주지 않는다.
//
// 흐름
// 1. withSupabase가 JWT를 검증한다. 사용자 id는 본문이 아니라 ctx.userClaims에서 얻는다.
// 2. 현재 한국 시간의 요일·시각을 계산한다.
// 3. 게임 목록과 태그 목록을 읽어 Claude에게 넘길 문맥을 만든다.
// 4. Claude Tool Use로 search_players 조건을 만든다.
// 5. 조건을 서버에서 다시 검증한다.
// 6. ctx.supabase.rpc('search_players', ...)를 호출한다.
//    auth.uid()가 필요하므로 supabaseAdmin을 쓰지 않는다.
// 7. { conditions, players }를 반환한다.

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { getAnthropicApiKey } from '../_shared/claude.ts'
import { errorResponse, readJsonObject } from '../_shared/http.ts'
import { getSeoulNow } from '../_shared/time.ts'

const MAX_QUESTION_LENGTH = 200

export interface SearchConditions {
  game_id: number | null
  weekday: number | null
  start_hour: number | null
  end_hour: number | null
  tags: string[] | null
}

// strict 도구의 스키마는 범위 제약을 강제하지 않으므로 값 범위는 5단계에서 검증한다.
export const SEARCH_PLAYERS_TOOL = {
  name: 'search_players',
  description:
    '게임 친구 검색 조건을 만든다. 질문에 없는 조건은 null로 둔다. ' +
    'weekday는 ISO 요일(1=월, 7=일), start_hour는 0~23, end_hour는 1~24이고 start_hour보다 커야 한다.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['game_id', 'weekday', 'start_hour', 'end_hour', 'tags'],
    properties: {
      game_id: { type: ['integer', 'null'] },
      weekday: { type: ['integer', 'null'] },
      start_hour: { type: ['integer', 'null'] },
      end_hour: { type: ['integer', 'null'] },
      tags: { type: ['array', 'null'], items: { type: 'string' } },
    },
  },
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed')

    const body = await readJsonObject(req)
    const question = body?.question
    if (
      typeof question !== 'string' ||
      question.trim() === '' ||
      question.length > MAX_QUESTION_LENGTH
    ) {
      return errorResponse(400, 'invalid_request')
    }

    const userId = ctx.userClaims?.id
    if (!userId) return errorResponse(401, 'unauthorized')

    const apiKey = getAnthropicApiKey()
    if (!apiKey) return errorResponse(500, 'server_misconfigured')

    const now = getSeoulNow()

    // TODO: 다음 단계에서 구현 (위 흐름의 3~7)
    // 3. ctx.supabase로 games, tag_vocabulary를 읽는다.
    // 4. new Anthropic({ apiKey }).messages.create(...)
    //    - model: CLAUDE_MODEL, tools: [SEARCH_PLAYERS_TOOL], tool_choice: { type: 'auto' }
    //    - 이 모델은 tool_choice any/tool이 400 오류이므로 도구를 쓰라는 지시를 system에 적는다.
    //    - thinking 설정은 보내지 않고 output_config: { effort: 'low' }로 비용을 낮춘다.
    //    - system에 now(요일·시각), 게임 목록, 태그 목록을 넣는다.
    //      "지금"은 start_hour=now.hour, end_hour=now.hour+1로 풀도록 안내한다.
    //    - stop_reason이 refusal이면 content를 읽지 말고 오류로 처리한다.
    //      claude-opus-5-5는 서버 측 fallback 사용을 권장한다. 구현할 때 최신 문서로 설정을 확인한다.
    // 5. game_id는 games에 있는지, 요일·시각은 범위 안인지, tags는 tag_vocabulary에 있는지 확인한다.
    //    start_hour >= end_hour인 자정 넘김 검색은 두 구간으로 나눠 호출하고 결과를 합친다.
    // 6. const { data, error } = await ctx.supabase.rpc('search_players', {
    //      p_game_id, p_weekday, p_start_hour, p_end_hour, p_tags })
    return Response.json({ error: 'not_implemented', now }, { status: 501 })
  }),
}
