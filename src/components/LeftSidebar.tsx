import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './LeftSidebar.module.css'

type MenuItem = {
  id: string
  label: string
  icon?: string
  children?: { path: string; label: string }[]
}

const menuData: MenuItem[] = [
  {
    id: 'system',
    label: '시스템관리',
    children: [{ path: '/system/users', label: '사용자관리' }],
  },
  {
    id: 'site',
    label: '사이드관리',
    children: [{ path: '/site/config', label: '사이트설정' }],
  },
  {
    id: 'customer',
    label: '고객관리',
    children: [{ path: '/customer/list', label: '고객목록' }],
  },
  {
    id: 'product',
    label: '상품관리',
    children: [{ path: '/product/list', label: '상품목록' }],
  },
  {
    id: 'display',
    label: '전시관리',
    children: [{ path: '/display/main', label: '메인전시' }],
  },
  {
    id: 'marketing',
    label: '마케팅관리',
    children: [{ path: '/marketing/coupon', label: '쿠폰관리' }],
  },
  {
    id: 'order',
    label: '주문관리',
    children: [{ path: '/order/status', label: '주문현황' }],
  },
  {
    id: 'cs',
    label: '고객센터',
    children: [{ path: '/cs/inquiry', label: '문의관리' }],
  },
  {
    id: 'settlement',
    label: '정산',
    children: [{ path: '/settlement/list', label: '정산목록' }],
  },
  {
    id: 'policy',
    label: '운영방침관리',
    children: [{ path: '/policy/terms', label: '약관관리' }],
  },
  { id: 'cti', label: 'CTI' },
]

type LeftSidebarProps = {
  collapsed: boolean
}

export default function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const location = useLocation()
  const [openIds, setOpenIds] = useState<string[]>(['order'])

  const toggle = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <aside className={`${styles.aside} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.sectionTitle}>ADMINISTRATOR</div>
      <nav className={styles.nav}>
        {menuData.map((item) => {
          const hasChildren = item.children && item.children.length > 0
          const isOpen = openIds.includes(item.id)
          const isActive =
            hasChildren &&
            item.children?.some((c) => location.pathname === c.path)

          return (
            <div key={item.id} className={styles.menuGroup}>
              {hasChildren ? (
                <>
                  <div
                    className={`${styles.menuRow} ${isActive ? styles.active : ''}`}
                  >
                    <span className={styles.menuLabel}>{item.label}</span>
                    <button
                      type="button"
                      className={styles.arrowBtn}
                      onClick={() => toggle(item.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? '메뉴 접기' : '메뉴 펼치기'}
                    >
                      <span className={`${styles.arrow} ${isOpen ? styles.arrowDown : ''}`}>
                        ›
                      </span>
                    </button>
                  </div>
                  {isOpen && (
                    <ul className={styles.subMenu}>
                      {item.children!.map((sub) => (
                        <li key={sub.path}>
                          <NavLink
                            to={sub.path}
                            className={({ isActive: active }) =>
                              `${styles.subLink} ${active ? styles.subActive : ''}`
                            }
                          >
                            {sub.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className={styles.menuRow}>
                  <span className={styles.menuLabel}>{item.label}</span>
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
