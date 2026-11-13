const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
const fullDateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

/** 메시지 옆 시각: "오후 9:05" */
export function formatTime(iso) {
  return timeFormat.format(new Date(iso))
}

/** 대화 목록 시각: 오늘이면 "오후 9:05", 어제면 "어제", 그 전이면 "11월 12일" */
export function formatListTime(iso, now = new Date()) {
  const date = new Date(iso)
  if (isSameDay(date, now)) return timeFormat.format(date)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(date, yesterday)) return '어제'
  return dateFormat.format(date)
}

/** 날짜 구분선: "2026년 11월 13일 목요일" */
export function formatDivider(iso) {
  return fullDateFormat.format(new Date(iso))
}

export function isDifferentDay(isoA, isoB) {
  return !isSameDay(new Date(isoA), new Date(isoB))
}
