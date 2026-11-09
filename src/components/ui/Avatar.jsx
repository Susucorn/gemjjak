import styles from './Avatar.module.css'

export function Avatar({ src, name = '', size = 44 }) {
  const dimensions = { width: size, height: size }

  if (src) return <img className={styles.avatar} style={dimensions} src={src} alt={name} />
  return (
    <span className={styles.avatar} style={dimensions} role="img" aria-label={name}>
      {name.slice(0, 1)}
    </span>
  )
}
