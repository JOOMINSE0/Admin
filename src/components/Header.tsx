import styles from './Header.module.css'

type HeaderProps = {
  onUserClick: () => void
  onMenuClick: () => void
}

export default function Header({ onUserClick, onMenuClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.menuBtn} onClick={onMenuClick} aria-label="메뉴">
        <span className={styles.hamburger}>≡</span>
      </button>
      <div className={styles.logo}>
        <span className={styles.logoText}>The SHOP</span>
      </div>
      <div className={styles.right}>
        <button
          type="button"
          className={styles.userBtn}
          onClick={onUserClick}
          aria-label="사용자 메뉴"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </button>
      </div>
    </header>
  )
}
