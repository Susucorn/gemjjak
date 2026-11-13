import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { Sheet } from '../../components/ui/Sheet'
import {
  ALL_DAY_KEYS,
  DAYS,
  HOURS,
  TIME_PRESETS,
  WEEKDAY_KEYS,
  WEEKEND_KEYS,
  dayLabel,
  describeHours,
  presetHours,
} from './hours'
import styles from './Onboarding.module.css'

/**
 * 요일마다 접속 시간을 고른다. 한 요일을 정한 뒤 [다른 요일에 복사]로 같은 시간을 여러 요일에 넣는다.
 * hours: { 1: Set, ..., 7: Set }
 */
export function TimeStep({ hours, onToggleHour, onSetHours }) {
  const [day, setDay] = useState(1)
  const [isCopyOpen, setIsCopyOpen] = useState(false)
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

      <button
        type="button"
        className={styles.copyButton}
        onClick={() => setIsCopyOpen(true)}
        disabled={current.size === 0}
      >
        {dayLabel(day)}요일 시간을 다른 요일에 복사
      </button>

      <WeekSummary hours={hours} activeDay={day} onSelectDay={setDay} />

      {isCopyOpen && (
        <CopyDaysSheet
          fromDay={day}
          hours={current}
          onApply={(days) => onSetHours(days, new Set(current))}
          onClose={() => setIsCopyOpen(false)}
        />
      )}
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

const QUICK_PICKS = [
  { label: '평일 전체', days: WEEKDAY_KEYS },
  { label: '주말 전체', days: WEEKEND_KEYS },
  { label: '매일', days: ALL_DAY_KEYS },
]

/** 고른 요일들에 지금 요일의 시간을 똑같이 넣는다. 그 요일의 기존 시간은 바뀐다. */
function CopyDaysSheet({ fromDay, hours, onApply, onClose }) {
  const [targets, setTargets] = useState(() => new Set())
  const candidates = ALL_DAY_KEYS.filter((key) => key !== fromDay)

  function toggle(key) {
    setTargets((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function pick(days) {
    const keys = days.filter((key) => key !== fromDay)
    const allPicked = keys.every((key) => targets.has(key))
    setTargets((prev) => {
      const next = new Set(prev)
      for (const key of keys) {
        if (allPicked) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  return (
    <Sheet
      title={`${dayLabel(fromDay)}요일 시간 복사`}
      description={`${describeHours(hours)}을 고른 요일에 똑같이 넣어요. 그 요일에 정해 둔 시간은 바뀌어요.`}
      submitLabel={targets.size > 0 ? `${targets.size}개 요일에 적용` : '적용'}
      submitDisabled={targets.size === 0}
      onSubmit={() => onApply([...targets])}
      onClose={onClose}
    >
      <div className={styles.chips}>
        {QUICK_PICKS.map((quick) => {
          const keys = quick.days.filter((key) => key !== fromDay)
          return (
            <Chip
              key={quick.label}
              selected={keys.every((key) => targets.has(key))}
              onClick={() => pick(quick.days)}
            >
              {quick.label}
            </Chip>
          )
        })}
      </div>
      <div className={styles.copyDays} role="group" aria-label="복사할 요일">
        {candidates.map((key) => (
          <button
            key={key}
            type="button"
            className={`${styles.copyDay} ${targets.has(key) ? styles.copyDayActive : ''}`}
            aria-pressed={targets.has(key)}
            onClick={() => toggle(key)}
          >
            {dayLabel(key)}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
