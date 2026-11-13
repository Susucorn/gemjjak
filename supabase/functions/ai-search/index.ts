// 탐색 화면의 AI 검색. 사용자가 쓴 문장을 탐색 필터(게임·장르·태그·요일·시각)로 바꿔 돌려준다.
// 실제 사람 찾기와 궁합 계산은 브라우저가 이 필터로 한다. Claude에게는 사용자 정보를 보내지 않는다.
//
// 흐름
// 1. withSupabase가 로그인 토큰을 검증한다.
// 2. 현재 한국 시간의 요일·시각을 계산한다("오늘 밤", "지금" 해석용).
// 3. 게임·장르·태그 이름 목록을 읽어 Claude에게 넘길 문맥을 만든다.
// 4. Claude가 JSON 스키마(structured outputs)에 맞춰 조건을 만든다.
// 5. 값 범위를 서버에서 다시 검사하고 { conditions }를 반환한다.

import '@supabase/functions-js/edge-runtime.d.ts'
import Anthropic from '@anthropic-ai/sdk'
import { withSupabase } from '@supabase/server'
import { CLAUDE_MODEL, getAnthropicApiKey } from '../_shared/claude.ts'
import { errorResponse, readJsonObject } from '../_shared/http.ts'
import { getSeoulNow } from '../_shared/time.ts'

const MAX_QUESTION_LENGTH = 200
const MAX_NAMES = 8
const MAX_NAME_LENGTH = 40
const MAX_CUSTOM_NAMES = 150

export interface SearchConditions {
  games: string[]
  genres: string[]
  tags: string[]
  weekdays: number[]
  hours: number[]
  summary: string
}

const CONDITIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['games', 'genres', 'tags', 'weekdays', 'hours', 'summary'],
  properties: {
    games: { type: 'array', items: { type: 'string' } },
    genres: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    weekdays: { type: 'array', items: { type: 'integer' } },
    hours: { type: 'array', items: { type: 'integer' } },
    summary: { type: 'string' },
  },
}

const WEEKDAY_LABEL = ['', '월', '화', '수', '목', '금', '토', '일']

function buildSystemPrompt(context: {
  games: string[]
  genres: string[]
  tags: string[]
  customNames: string[]
}): string {
  return `너는 게임 친구 매칭 서비스 "겜짝"의 검색 도우미다. 사용자가 어떤 게임 친구를 찾는지 한국어로 적으면, 그 문장을 탐색 필터로 바꾼다.

필드
- games: 같이 할 게임. 아래 게임 목록에 같은 게임이 있으면 목록의 이름을 그대로 쓴다(별명·줄임말 포함: "롤" → "리그 오브 레전드"). 목록에 없으면 사용자가 쓴 이름을 쓴다.
- genres: 게임 대신 장르를 말했을 때만 채운다. 장르 목록의 이름을 쓴다.
- tags: 플레이 스타일, 하는 콘텐츠, 원하는 사람의 특징. 태그 목록에서 뜻이 같은 것을 고른다("빡겜" → 목록의 비슷한 태그). 목록에 없으면 짧은 단어로 쓴다.
- weekdays: ISO 요일 번호(1=월 … 7=일). 평일은 1~5, 주말은 6과 7. "오늘", "내일"은 현재 요일 기준으로 계산한다.
- hours: 접속 시각(0~23). 숫자 하나는 그 시각부터 1시간이다. 새벽 0~5, 아침 6~8, 오전 6~11, 점심 11~13, 오후 12~17, 저녁 18~21, 밤 20~23, 늦은 밤 22~23과 0~1. "지금"은 현재 시각과 다음 시각이다.
- summary: 이해한 조건을 한국어 한 문장으로 요약한다. 예: "주말 저녁에 리그 오브 레전드를 즐겜으로 할 사람을 찾을게요."

규칙
- 문장에 없는 조건은 빈 배열로 둔다. 추측해서 채우지 않는다.
- 각 배열은 ${MAX_NAMES}개 이하로 쓴다.
- 게임 친구 찾기와 관계없는 요청이면 모든 배열을 비우고 summary에 "어떤 게임 친구를 찾는지 알려 주세요."라고 쓴다.

게임 목록 (이름: 별명)
${context.games.join('\n')}

장르 목록
${context.genres.join(', ')}

태그 목록
${context.tags.join(', ')}

다른 사용자가 직접 입력한 게임·태그 이름
${context.customNames.join(', ') || '(없음)'}`
}

function cleanNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const names = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= MAX_NAME_LENGTH)
  return [...new Set(names)].slice(0, MAX_NAMES)
}

function cleanNumbers(value: unknown, min: number, max: number): number[] {
  if (!Array.isArray(value)) return []
  const numbers = value.filter(
    (item): item is number => Number.isInteger(item) && item >= min && item <= max,
  )
  return [...new Set(numbers)].sort((a, b) => a - b)
}

/** Claude 출력이 스키마를 지켜도 값 범위는 서버에서 다시 확인한다. */
function cleanConditions(raw: Record<string, unknown>): SearchConditions {
  return {
    games: cleanNames(raw.games),
    genres: cleanNames(raw.genres),
    tags: cleanNames(raw.tags),
    weekdays: cleanNumbers(raw.weekdays, 1, 7),
    hours: cleanNumbers(raw.hours, 0, 23),
    summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 200) : '',
  }
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed')

    const body = await readJsonObject(req)
    const question = typeof body?.question === 'string' ? body.question.trim() : ''
    if (question === '' || question.length > MAX_QUESTION_LENGTH) {
      return errorResponse(400, 'invalid_request')
    }

    if (!ctx.userClaims?.id) return errorResponse(401, 'unauthorized')

    const apiKey = getAnthropicApiKey()
    if (!apiKey) return errorResponse(500, 'server_misconfigured')

    // 사용자 권한(RLS)으로 이름 목록만 읽는다.
    const [games, genres, vocabulary, customGames, customTags] = await Promise.all([
      ctx.supabase.from('games').select('name, aliases').order('sort_order'),
      ctx.supabase.from('genres').select('name').order('sort_order'),
      ctx.supabase.from('tag_vocabulary').select('tag'),
      ctx.supabase.from('user_custom_games').select('name').limit(MAX_CUSTOM_NAMES),
      ctx.supabase.from('user_custom_tags').select('name').limit(MAX_CUSTOM_NAMES),
    ])
    const failed = [games, genres, vocabulary, customGames, customTags].find((r) => r.error)
    if (failed) return errorResponse(500, 'catalog_unavailable')

    const system = buildSystemPrompt({
      games: games.data!.map((game) =>
        game.aliases?.length ? `${game.name}: ${game.aliases.join(', ')}` : game.name,
      ),
      genres: genres.data!.map((genre) => genre.name),
      tags: [...new Set(vocabulary.data!.map((row) => row.tag))],
      customNames: [
        ...new Set([...customGames.data!, ...customTags.data!].map((row) => row.name)),
      ],
    })

    const now = getSeoulNow()
    const client = new Anthropic({ apiKey })

    let response
    try {
      response = await client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        // 짧은 추출 작업이라 생각을 적게 하도록 낮춘다.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: CONDITIONS_SCHEMA },
        },
        // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도한다.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [
          {
            role: 'user',
            content: `현재 한국 시간: ${WEEKDAY_LABEL[now.weekday]}요일(${now.weekday}) ${now.hour}시\n\n찾는 사람: ${question}`,
          },
        ],
      } as Anthropic.Beta.MessageCreateParamsNonStreaming)
    } catch (error) {
      console.error('claude request failed', error)
      return errorResponse(502, 'ai_unavailable')
    }

    if (response.stop_reason === 'refusal') return errorResponse(422, 'refused')
    if (response.stop_reason === 'max_tokens') return errorResponse(502, 'ai_unavailable')

    const text = response.content.find((block) => block.type === 'text')
    if (!text || text.type !== 'text') return errorResponse(502, 'ai_unavailable')

    let raw: unknown
    try {
      raw = JSON.parse(text.text)
    } catch {
      return errorResponse(502, 'ai_unavailable')
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return errorResponse(502, 'ai_unavailable')
    }

    return Response.json({ conditions: cleanConditions(raw as Record<string, unknown>) })
  }),
}
