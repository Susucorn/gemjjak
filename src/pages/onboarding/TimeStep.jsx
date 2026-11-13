import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { DAYS, HOURS, TIME_PRESETS, dayLabel, describeHours, presetHours } from './hours'
import styles from './Onboarding.module.css'

/**
 * 요일마다 접속 시간을 고른다. 요일 탭은 여러 개 고를 수 있고, 시간을 누르면 고른 요일 모두에 똑같이 적용된다.
 * hours: { 1: Set, ..., 7: Set }
 * onChangeDays(days, change): days 각각의 Set을 change(Set) 결과로 바꾼다.
 */
export function TimeStep({ hours, onChangeDays }) {
  const [days, setDays] = useState([1])

  // 고른 요일 모두에 있으면 'all', 일부에만 있으면 'some'
  function hourState(hour) {
    const count = days.filter((day) => hours[day].has(hour)).length
    if (count === 0) return 'none'
    return count === days.length ? 'all' : 'some'
  }

  /** 고른 요일 모두에 이미 있으면 빼고, 아니면 모두에 넣는다. */
  function toggleHours(range) {
    const allOn = range.every((hour) => hourState(hour) === 'all')
    onChangeDays(days, (set) => {
      for (const hour of range) {
        if (allOn) set.delete(hour)
        else set.add(hour)
      }
      return set
    })
  }

  function toggleDay(day) {
    setDays((prev) =>
      prev.includes(day)
        ? prev.filter((item) => item !== day)
        : [...prev, day].sort((a, b) => a - b),
    )
  }

  const noDay = days.length === 0
  const daysText = days.map(dayLabel).join('·')
  const hasAny = days.some((day) => hours[day].size > 0)
  const hasPartial = days.length > 1 && HOURS.some((hour) => hourState(hour) === 'some')

  return (
    <div className={styles.timeStep}>
      <p className={styles.hourHint}>요일을 여러 개 누르면 같은 시간을 한 번에 넣을 수 있어요.</p>
      <div className={styles.dayTabs} role="group" aria-label="요일 (여러 개 선택 가능)">
        {DAYS.map((item) => {
          const count = hours[item.key].size
          const selected = days.includes(item.key)
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.dayTab} ${selected ? styles.dayTabActive : ''} ${
                item.key >= 6 ? styles.dayTabWeekend : ''
              }`}
              aria-pressed={selected}
              aria-label={`${item.label}요일${count > 0 ? `, ${count}시간` : ''}`}
              onClick={() => toggleDay(item.key)}
            >
              <span className={styles.dayTabLabel}>{item.label}</span>
              <span className={styles.dayTabCount}>{count > 0 ? `${count}h` : '–'}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.dayHeader}>
        <h2 className={styles.groupTitle}>
          {noDay ? '요일을 먼저 골라 주세요' : `${daysText}요일 접속 시간`}
        </h2>
        {hasAny && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => onChangeDays(days, () => new Set())}
          >
            비우기
          </button>
        )}
      </div>

      <div className={styles.chips}>
        {TIME_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            disabled={noDay}
            selected={!noDay && presetHours(preset).every((hour) => hourState(hour) === 'all')}
            onClick={() => toggleHours(presetHours(preset))}
          >
            {preset.label}
          </Chip>
        ))}
      </div>

      <p className={styles.hourHint}>
        숫자 칸 하나는 1시간이에요. 예: 21 → 21시~22시
        {hasPartial && (
          <>
            <br />
            연한 칸은 고른 요일 중 일부에만 있는 시간이에요. 누르면 모두에 넣어요.
          </>
        )}
      </p>

      <div className={styles.hourGrid} role="group" aria-label={`${daysText}요일 접속 시간`}>
        {HOURS.map((hour) => {
          const state = hourState(hour)
          return (
            <button
              key={hour}
              type="button"
              className={`${styles.hourCell} ${
                state === 'all'
                  ? styles.hourCellSelected
                  : state === 'some'
                    ? styles.hourCellPartial
                    : ''
              }`}
              aria-pressed={state === 'all' ? true : state === 'some' ? 'mixed' : false}
              aria-label={`${hour}시부터 ${hour + 1}시`}
              disabled={noDay}
              onClick={() => toggleHours([hour])}
            >
              {hour}
            </button>
          )
        })}
      </div>

      <WeekSummary hours={hours} activeDays={days} onSelectDay={(day) => setDays([day])} />
    </div>
  )
}

/** 일주일 요약. 요일 줄을 누르면 그 요일만 고른다. */
function WeekSummary({ hours, activeDays, onSelectDay }) {
  return (
    <section className={styles.week} aria-label="일주일 요약">
      {DAYS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`${styles.weekRow} ${activeDays.includes(item.key) ? styles.weekRowActive : ''}`}
          onClick={() => onSelectDay(item.key)}
          aria-label={`${item.label}요일 ${describeHours(hours[item.key])}. 눌러서 수정`}
        >
          <span className={styles.weekDay}>{item.label}</span>
          <span className={styles.weekBar} aria-hidden="true">
            {HOURS.map((hour) => (
              <span
                key={hour}
                className={hours[item.key].has(hour) ? styles.weekOn : styles.weekOff}
              />
            ))}
          </span>
        </button>
      ))}
      <div className={styles.weekAxis} aria-hidden="true">
        <span />
        <span className={styles.weekAxisLabels}>
          <span>0시</span>
          <span>6시</span>
          <span>12시</span>
          <span>18시</span>
          <span>24시</span>
        </span>
      </div>
    </section>
  )
}
