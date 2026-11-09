export function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status })
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
