// 디스코드 초대 링크로 서버 아이콘과 인원을 가져온다.
// 공개 API라 로그인이나 봇 토큰이 필요 없고, 브라우저에서 바로 불러도 된다(CORS 허용).
// 같은 링크를 여러 번 부르지 않도록 몇 분 동안 기억해 둔다.

const CACHE_MS = 5 * 60 * 1000
const cache = new Map()

export function inviteCode(inviteUrl) {
  return inviteUrl.split('/').pop()
}

/**
 * 반환: { valid: true, guildName, iconUrl, members, online } 또는 { valid: false }
 * 링크가 만료됐으면 valid: false. 네트워크 오류는 throw한다.
 */
async function loadInvite(code) {
  const response = await fetch(
    `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
  )
  if (response.status === 404) return { valid: false }
  if (!response.ok) throw new Error(`discord ${response.status}`)
  const data = await response.json()
  const guild = data.guild ?? {}
  return {
    valid: true,
    guildName: guild.name ?? null,
    iconUrl:
      guild.id && guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
        : null,
    members: data.approximate_member_count ?? null,
    online: data.approximate_presence_count ?? null,
  }
}

export function fetchInviteInfo(inviteUrl) {
  const code = inviteCode(inviteUrl)
  const cached = cache.get(code)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise
  const promise = loadInvite(code)
  cache.set(code, { at: Date.now(), promise })
  // 실패한 요청은 기억하지 않고 다음에 다시 시도한다.
  promise.catch(() => cache.delete(code))
  return promise
}
