import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { DAYS, HOURS, TIME_PRESETS, dayLabel, describeHours, presetHours } from './hours'
import styles from './Onboarding.module.css'

/**
 * 요일마다 접속 시간을 고른다. 위쪽 요일 탭으로 요일을 바꾸고, 아래 일주일 요약으로 전체를 확인한다.
 * hours: { 1: Set, ..., 7: Set }
 */
export function TimeStep({ hours, onToggleHour, onSetHours }) {
  const [day, setDay] = useState(1)
  const current = hours[day]

  function togglePreset(preset) {
    const range = presetHours(preset)
    const allSelected = range.every((hour) => current.has(hour))
    const next = new Set(current)
    for (const hour of range) {
      if (allSelected) next.delete(hour)
      else next.add(hour)
    }
    onSetHours([day], next)
  }

  return (
    <div className={styles.timeStep}>
      <div className={styles.dayTabs} role="group" aria-label="요일">
        {DAYS.map((item) => {
          const count = hours[item.key].size
          const selected = day === item.key
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.dayTab} ${selected ? styles.dayTabActive : ''} ${
                item.key >= 6 ? styles.dayTabWeekend : ''
              }`}
              aria-pressed={selected}
              aria-label={`${item.label}요일${count > 0 ? `, ${count}시간` : ''}`}
              onClick={() => setDay(item.key)}
            >
              <span className={styles.dayTabLabel}>{item.label}</span>
              <span className={styles.dayTabCount}>{count > 0 ? `${count}h` : '–'}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.dayHeader}>
        <h2 className={styles.groupTitle}>{dayLabel(day)}요일 접속 시간</h2>
        {current.size > 0 && (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => onSetHours([day], new Set())}
          >
            비우기
          </button>
        )}
      </div>

      <div className={styles.chips}>
        {TIME_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            selected={presetHours(preset).every((hour) => current.has(hour))}
            onClick={() => togglePreset(preset)}
          >
            {preset.label}
          </Chip>
        ))}
      </div>

      <p className={styles.hourHint}>숫자 칸 하나는 1시간이에요. 예: 21 → 21시~22시</p>

      <div className={styles.hourGrid} role="group" aria-label={`${dayLabel(day)}요일 접속 시간`}>
        {HOURS.map((hour) => {
          const selected = current.has(hour)
          return (
            <button
              key={hour}
              type="button"
              className={`${styles.hourCell} ${selected ? styles.hourCellSelected : ''}`}
              aria-pressed={selected}
              aria-label={`${hour}시부터 ${hour + 1}시`}
              onClick={() => onToggleHour(day, hour)}
            >
              {hour}
            </button>
          )
        })}
      </div>

      <WeekSummary hours={hours} activeDay={day} onSelectDay={setDay} />
    </div>
  )
}

/** 일주일 요약. 요일 줄을 누르면 그 요일로 이동한다. */
function WeekSummary({ hours, activeDay, onSelectDay }) {
  return (
    <section className={styles.week} aria-label="일주일 요약">
      {DAYS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`${styles.weekRow} ${activeDay === item.key ? styles.weekRowActive : ''}`}
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
