import styles from './GameTile.module.css'

// 공식 이미지 대신 쓰는 직접 만든 일러스트 타일. 게임마다 색과 모양만 다르게 준다.
const ART = {
  원신: { theme: 'sky', mark: '✦' },
  '리그 오브 레전드': { theme: 'gold', mark: '◆' },
  발로란트: { theme: 'rose', mark: '▲' },
  '붕괴: 스타레일': { theme: 'night', mark: '✧' },
  명조: { theme: 'mint', mark: '◎' },
}

const FALLBACK = { theme: 'violet', mark: '●' }

export function GameTile({ name, className = '' }) {
  const { theme, mark } = ART[name] ?? FALLBACK
  return (
    <span className={`${styles.tile} ${styles[theme]} ${className}`} aria-hidden="true">
      <span className={styles.orb} />
      <span className={styles.mark}>{mark}</span>
    </span>
  )
}
