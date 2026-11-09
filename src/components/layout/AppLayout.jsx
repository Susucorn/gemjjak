import { Outlet } from 'react-router-dom'
import { BottomTabBar } from './BottomTabBar'
import { Sidebar } from './Sidebar'
import styles from './AppLayout.module.css'

// 탭바와 사이드바 전환은 CSS 미디어 쿼리(1024px)로만 처리한다.
export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}
