import { NavLink } from 'react-router-dom'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import styles from './BottomTabBar.module.css'

export function BottomTabBar() {
  return (
    <nav className={styles.bar} aria-label="주요 메뉴">
      {NAV_ITEMS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          <NavIcon name={icon} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
