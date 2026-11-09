import styles from './Chip.module.css'

export function Chip({ selected = false, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`${styles.chip} ${selected ? styles.selected : ''} ${className}`}
      {...props}
    />
  )
}
