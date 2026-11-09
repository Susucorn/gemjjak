import { NavLink } from 'react-router-dom'
import { NavIcon } from './NavIcon'
import { NAV_ITEMS } from './navItems'
import styles from './Sidebar.module.css'

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <p className={styles.logo}>겜짝</p>
      <nav className={styles.nav} aria-label="주요 메뉴">
        {NAV_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.item} ${styles.active}` : styles.item
            }
          >
            <NavIcon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
