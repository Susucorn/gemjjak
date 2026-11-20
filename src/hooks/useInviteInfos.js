import { useEffect, useState } from 'react'
import { fetchInviteInfo } from '../services/discordInvite'

/**
 * 여러 디스코드 초대 링크의 아이콘·인원을 한꺼번에 불러온다.
 * 반환: { infos: Map(초대 링크 → info 또는 null), done }
 *   info는 fetchInviteInfo 결과({ valid, members, online, … }), 불러오지 못하면 null이다.
 *   done은 모든 링크의 응답(성공·실패)이 도착했는지다. 정렬처럼 전부 모인 뒤 한 번만 할 일에 쓴다.
 * 링크마다 응답이 오는 대로 infos에 채워 준다. 같은 링크는 discordInvite가 몇 분간 기억한다.
 */
export function useInviteInfos(inviteUrls) {
  // 배열이 매번 새로 만들어져도 링크 목록이 같으면 다시 부르지 않도록 문자열 키로 비교한다.
  const key = [...new Set(inviteUrls)].sort().join('\n')
  const [state, setState] = useState({ key: null, infos: new Map(), done: false })

  useEffect(() => {
    const urls = key ? key.split('\n') : []
    let cancelled = false
    const put = (url, info) => {
      if (cancelled) return
      setState((prev) => {
        const infos = new Map(prev.key === key ? prev.infos : undefined)
        infos.set(url, info)
        return { key, infos, done: prev.key === key && prev.done }
      })
    }
    Promise.allSettled(
      urls.map((url) =>
        fetchInviteInfo(url).then(
          (info) => put(url, info),
          () => put(url, null),
        ),
      ),
    ).then(() => {
      if (!cancelled) setState((prev) => ({ ...prev, key, done: true }))
    })
    return () => {
      cancelled = true
    }
  }, [key])

  if (state.key === key) return state
  return { infos: new Map(), done: key === '' }
}
