import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'
import styles from './Layout.module.css'

export default function Layout() {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)

  return (
    <div className={styles.wrapper}>
      <Header
        onUserClick={() => setRightSidebarOpen((o) => !o)}
        onMenuClick={() => setLeftSidebarCollapsed((c) => !c)}
      />
      <div className={styles.body}>
        <LeftSidebar collapsed={leftSidebarCollapsed} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <RightSidebar open={rightSidebarOpen} onClose={() => setRightSidebarOpen(false)} />
    </div>
  )
}
