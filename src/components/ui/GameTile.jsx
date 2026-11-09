import styles from './GameTile.module.css'

// 공식 이미지 대신 쓰는 직접 만든 일러스트 타일.
// 색은 장르로 정하고, 가운데에는 게임 이름 첫 글자를 넣는다.
const GENRE_THEME = {
  'FPS·슈팅': 'rose',
  배틀로얄: 'amber',
  MOBA: 'gold',
  MMORPG: 'violet',
  '오픈월드 RPG': 'sky',
  '수집형 RPG': 'night',
  액션: 'coral',
  '전략·카드': 'teal',
  스포츠: 'green',
  '샌드박스·생존': 'mint',
}

export function GameTile({ name, genre, className = '' }) {
  const theme = GENRE_THEME[genre] ?? 'violet'
  return (
    <span className={`${styles.tile} ${styles[theme]} ${className}`} aria-hidden="true">
      <span className={styles.orb} />
      <span className={styles.mark}>{name.slice(0, 1)}</span>
    </span>
  )
}
