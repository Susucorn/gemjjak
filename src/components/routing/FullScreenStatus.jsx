import styles from './FullScreenStatus.module.css'

export function FullScreenStatus({ children }) {
  return (
    <div className={styles.status} role="status">
      {children}
    </div>
  )
}
