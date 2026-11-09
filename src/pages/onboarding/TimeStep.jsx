import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { DAY_TYPES, HOURS, TIME_PRESETS, describeHours, presetHours } from './hours'
import styles from './Onboarding.module.css'

export function TimeStep({ hours, onToggleHour, onSetHours }) {
  const [dayType, setDayType] = useState('weekday')
  const current = hours[dayType]
  const other = dayType === 'weekday' ? 'weekend' : 'weekday'
  const otherLabel = DAY_TYPES.find((type) => type.key === other).label

  function togglePreset(preset) {
    const range = presetHours(preset)
    const allSelected = range.every((hour) => current.has(hour))
    const next = new Set(current)
    for (const hour of range) {
      if (allSelected) next.delete(hour)
      else next.add(hour)
    }
    onSetHours(dayType, next)
  }

  return (
    <div className={styles.timeStep}>
      <div className={styles.segment} role="group" aria-label="요일 종류">
        {DAY_TYPES.map((type) => (
          <button
            key={type.key}
            type="button"
            className={`${styles.segmentItem} ${dayType === type.key ? styles.segmentActive : ''}`}
            aria-pressed={dayType === type.key}
            onClick={() => setDayType(type.key)}
          >
            {type.label}
            {hours[type.key].size > 0 && (
              <span className={styles.segmentCount}>{hours[type.key].size}시간</span>
            )}
          </button>
        ))}
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

      <div
        className={styles.hourGrid}
        role="group"
        aria-label={`${DAY_TYPES.find((type) => type.key === dayType).label} 접속 시간`}
      >
        {HOURS.map((hour) => {
          const selected = current.has(hour)
          return (
            <button
              key={hour}
              type="button"
              className={`${styles.hourCell} ${selected ? styles.hourCellSelected : ''}`}
              aria-pressed={selected}
              aria-label={`${hour}시부터 ${hour + 1}시`}
              onClick={() => onToggleHour(dayType, hour)}
            >
              {hour}
            </button>
          )
        })}
      </div>

      <p className={styles.timeSummary}>
        <strong>평일</strong> {describeHours(hours.weekday)}
        <br />
        <strong>주말</strong> {describeHours(hours.weekend)}
      </p>

      {hours[other].size > 0 && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => onSetHours(dayType, new Set(hours[other]))}
        >
          {otherLabel}과 똑같이 맞추기
        </button>
      )}
    </div>
  )
}
