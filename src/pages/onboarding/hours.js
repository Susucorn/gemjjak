export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** ISO 요일 번호. DB availability.weekday와 같다. */
export const DAYS = [
  { key: 1, label: '월' },
  { key: 2, label: '화' },
  { key: 3, label: '수' },
  { key: 4, label: '목' },
  { key: 5, label: '금' },
  { key: 6, label: '토' },
  { key: 7, label: '일' },
]

export const TIME_PRESETS = [
  { label: '새벽', start: 0, end: 6 },
  { label: '오전', start: 6, end: 12 },
  { label: '오후', start: 12, end: 18 },
  { label: '저녁·밤', start: 18, end: 24 },
]

/** { 1: Set, 2: Set, ..., 7: Set } — 요일별 접속 시각(0~23) */
export function emptyHours() {
  return Object.fromEntries(DAYS.map((day) => [day.key, new Set()]))
}

export function totalHours(hours) {
  return DAYS.reduce((sum, day) => sum + hours[day.key].size, 0)
}

export function dayLabel(key) {
  return DAYS.find((day) => day.key === key)?.label ?? ''
}

export function presetHours({ start, end }) {
  return HOURS.filter((hour) => hour >= start && hour < end)
}

/** [20, 21, 22, 1] → "1시–2시, 20시–23시" */
export function describeHours(hours) {
  const sorted = [...hours].sort((a, b) => a - b)
  if (sorted.length === 0) return '접속 안 함'

  const ranges = []
  for (const hour of sorted) {
    const last = ranges.at(-1)
    if (last && last.end === hour) last.end = hour + 1
    else ranges.push({ start: hour, end: hour + 1 })
  }
  return ranges.map(({ start, end }) => `${start}시–${end}시`).join(', ')
}
