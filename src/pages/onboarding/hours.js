export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export const DAY_TYPES = [
  { key: 'weekday', label: '평일' },
  { key: 'weekend', label: '주말' },
]

export const TIME_PRESETS = [
  { label: '새벽', start: 0, end: 6 },
  { label: '오전', start: 6, end: 12 },
  { label: '오후', start: 12, end: 18 },
  { label: '저녁·밤', start: 18, end: 24 },
]

export function presetHours({ start, end }) {
  return HOURS.filter((hour) => hour >= start && hour < end)
}

/** [20, 21, 22, 1] → "1시–2시, 20시–23시" */
export function describeHours(hours) {
  const sorted = [...hours].sort((a, b) => a - b)
  if (sorted.length === 0) return '선택 안 함'

  const ranges = []
  for (const hour of sorted) {
    const last = ranges.at(-1)
    if (last && last.end === hour) last.end = hour + 1
    else ranges.push({ start: hour, end: hour + 1 })
  }
  return ranges.map(({ start, end }) => `${start}시–${end}시`).join(', ')
}
