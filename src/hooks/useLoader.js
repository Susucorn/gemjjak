import { useCallback, useEffect, useState } from 'react'

/**
 * load()가 돌려준 Promise 결과를 { status, data, reload }로 알려 준다.
 * status: 'loading' | 'ready' | 'error'
 * load는 useCallback으로 고정해서 넘긴다. 바뀌면 다시 불러온다.
 * 화면을 벗어난 뒤 늦게 도착한 응답은 버린다.
 */
export function useLoader(load) {
  const [state, setState] = useState({ status: 'loading', data: null })
  const [loadKey, setLoadKey] = useState(0)

  useEffect(() => {
    let isStale = false
    load().then(
      (data) => {
        if (!isStale) setState({ status: 'ready', data })
      },
      () => {
        if (!isStale) setState((prev) => ({ ...prev, status: 'error' }))
      },
    )
    return () => {
      isStale = true
    }
  }, [load, loadKey])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading' }))
    setLoadKey((key) => key + 1)
  }, [])

  return { ...state, reload }
}
