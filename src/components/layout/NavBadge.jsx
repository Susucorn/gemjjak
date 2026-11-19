import styles from './NavBadge.module.css'

/**
 * 탭 메뉴의 안 읽은 수 배지. count가 0이면 아무것도 그리지 않는다.
 * placement="corner"는 아이콘 오른쪽 위에 겹치고(하단 탭바), "end"는 줄 끝에 놓인다(사이드바).
 * 숫자는 눈으로만 보이고, 화면 낭독기에는 "안 읽은 메시지 N개"로 읽힌다.
 */
export function NavBadge({ count, placement }) {
  if (!count) return null
  const shown = count > 99 ? '99+' : String(count)
  return (
    <>
      <span className={`${styles.badge} ${styles[placement]}`} aria-hidden="true">
        {shown}
      </span>
      <span className={styles.srOnly}>, 안 읽은 메시지 {count}개</span>
    </>
  )
}
