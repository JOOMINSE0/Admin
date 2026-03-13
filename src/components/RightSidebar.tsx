import { useEffect } from 'react'
import styles from './RightSidebar.module.css'

type RightSidebarProps = {
  open: boolean
  onClose: () => void
}

export default function RightSidebar({ open, onClose }: RightSidebarProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.overlay}
          onClick={onClose}
          aria-label="사이드바 닫기"
        />
      )}
      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>사용자 메뉴</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className={styles.content}>
          <div className={styles.menuItem}>프로필</div>
          <div className={styles.menuItem}>알림 설정</div>
          <div className={styles.menuItem}>비밀번호 변경</div>
          <div className={styles.menuItem}>로그아웃</div>
        </div>
      </aside>
    </>
  )
}
