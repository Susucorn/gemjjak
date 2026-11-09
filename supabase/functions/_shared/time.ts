const ISO_WEEKDAY: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

export interface SeoulNow {
  weekday: number // ISO: 1=월, 7=일 (availability.weekday와 같은 기준)
  hour: number // 0~23
}

/** Edge Function 서버는 UTC로 동작하므로 Date.getDay()/getHours()를 쓰면 안 된다. */
export function getSeoulNow(date: Date = new Date()): SeoulNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''

  return { weekday: ISO_WEEKDAY[part('weekday')], hour: Number(part('hour')) }
}
