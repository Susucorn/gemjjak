// 디스코드 로그인은 다른 사이트를 거쳐 돌아오므로 라우터 state가 사라진다.
// 로그인 전에 가려던 주소를 sessionStorage에 잠깐 보관했다가 돌아온 뒤 꺼내 쓴다.
const KEY = 'gemjjak:returnTo'

export function saveReturnTo(path) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 로그인은 진행된다. 홈으로 돌아갈 뿐이다.
  }
}

/** 앱 내부 경로만 돌려준다. 외부 주소로 튕겨 나가는 것을 막기 위해서다. */
export function readReturnTo() {
  try {
    const path = sessionStorage.getItem(KEY)
    if (path && path.startsWith('/') && !path.startsWith('//') && path !== '/login') return path
  } catch {
    // 위와 같은 이유로 무시한다.
  }
  return '/'
}
