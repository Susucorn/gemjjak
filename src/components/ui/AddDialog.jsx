import { useState } from 'react'
import { Sheet } from './Sheet'
import styles from './Sheet.module.css'

/** 목록에 없는 값을 하나 입력받는 창. {isOpen && <AddDialog ... />}로 쓴다. */
export function AddDialog({ title, description, placeholder, maxLength, onSave, onClose }) {
  const [value, setValue] = useState('')
  const trimmed = value.trim()

  return (
    <Sheet
      title={title}
      description={description}
      submitDisabled={!trimmed}
      onSubmit={() => onSave(trimmed)}
      onClose={onClose}
    >
      <div className={styles.field}>
        <input
          className={styles.input}
          aria-label={title}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          // 창을 열면 바로 입력할 수 있게 한다.
          autoFocus
          enterKeyHint="done"
          onChange={(event) => setValue(event.target.value)}
        />
        {maxLength && (
          <span className={styles.counter}>
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </Sheet>
  )
}
