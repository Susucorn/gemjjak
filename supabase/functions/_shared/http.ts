/** detail은 원인을 찾기 위한 짧은 설명이다. 키나 개인 정보를 넣지 않는다. */
export function errorResponse(status: number, error: string, detail?: string): Response {
  return Response.json(detail ? { error, detail } : { error }, { status })
}

/** 본문이 JSON 객체가 아니면 null을 반환한다. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}
