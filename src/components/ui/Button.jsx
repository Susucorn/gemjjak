import styles from './Button.module.css'

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />
  )
}
