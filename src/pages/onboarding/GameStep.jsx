import { GameTile } from '../../components/ui/GameTile'
import styles from './Onboarding.module.css'

export function GameStep({ games, selectedIds, onToggle }) {
  return (
    <ul className={styles.gameGrid}>
      {games.map((game) => {
        const selected = selectedIds.has(game.id)
        return (
          <li key={game.id}>
            <button
              type="button"
              className={`${styles.gameCard} ${selected ? styles.gameCardSelected : ''}`}
              aria-pressed={selected}
              onClick={() => onToggle(game.id)}
            >
              <GameTile name={game.name} />
              <span className={styles.gameName}>{game.name}</span>
              <span className={styles.check} aria-hidden="true">
                ✓
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
