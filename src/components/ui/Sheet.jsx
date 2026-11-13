import { useEffect, useId, useRef } from 'react'
import { Button } from './Button'
import styles from './Sheet.module.css'

/**
 * 작은 입력 창. 모바일에서는 아래에서 올라오고 데스크톱에서는 가운데에 뜬다.
 * 열 때 그리고 닫을 때 없애는 방식으로 쓴다: {isOpen && <Sheet ... />}
 * 네이티브 <dialog>를 써서 Esc 닫기, 초점 가두기, 닫은 뒤 초점 되돌리기를 브라우저에 맡긴다.
 * 저장 버튼을 누르면 onSubmit을 부른 뒤 닫는다.
 */
export function Sheet({
  title,
  description,
  children,
  submitLabel = '저장',
  submitDisabled = false,
  onSubmit,
  onClose,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    if (submitDisabled) return
    onSubmit()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      // Esc로 닫을 때. close 이벤트에 걸면 개발 모드(StrictMode)가 effect를 한 번 정리하며 부른
      // dialog.close() 때문에 창이 열리자마자 닫힌다. 그래서 cancel만 받아 직접 닫는다.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // 바깥 어두운 영역을 누르면 닫는다. 키보드 사용자는 Esc나 취소 버튼으로 닫는다.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <form className={styles.panel} onSubmit={handleSubmit}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && <p className={styles.description}>{description}</p>}
        {children}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
