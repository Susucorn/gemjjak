import { NavLink } from 'react-router-dom'
import { useUnreadChats } from '../../hooks/useUnreadChats'
import { NavBadge } from './NavBadge'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import styles from './BottomTabBar.module.css'

export function BottomTabBar() {
  const { count } = useUnreadChats()
  return (
    <nav className={styles.bar} aria-label="주요 메뉴">
      {NAV_ITEMS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          <span className={styles.iconWrap}>
            <NavIcon name={icon} />
            {icon === 'chat' && <NavBadge count={count} placement="corner" />}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
