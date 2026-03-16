import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './LeftSidebar.module.css'

type SubMenuItem =
  | { path: string; label: string }
  | { path: string; label: string; children: { path: string; label: string }[] }

type MenuItem = {
  id: string
  label: string
  icon?: string
  children?: SubMenuItem[]
}

const menuData: MenuItem[] = [
  {
    id: 'system',
    label: '시스템 관리',
    children: [
      { path: '/system/admin', label: '관리자관리' },
      { path: '/system/delivery', label: '배송관리' },
      { path: '/system/psychotropic', label: '향정관리' },
      { path: '/system/multistock', label: 'MultiStock' },
      { path: '/system/unit-return', label: '낱알반품' },
      { path: '/system/crm', label: 'CRM데이터관리' },
    ],
  },
  {
    id: 'site',
    label: '사이트 관리',
    children: [
      { path: '/site/notice', label: '공지사항관리' },
      { path: '/site/popup', label: '메인팝업관리' },
      { path: '/site/promotion', label: '프로모션관리' },
      { path: '/site/landing', label: '랜딩페이지관리' },
    ],
  },
  {
    id: 'customer',
    label: '고객관리',
    children: [
      { path: '/customer/members', label: '회원관리' },
      { path: '/customer/suppliers', label: '공급사관리' },
      { path: '/customer/status', label: '현황관리' },
      {
        path: '/customer/contract',
        label: '전자계약서',
        children: [{ path: '/customer/contract/consent-download', label: '전자동의서 다운로드' }],
      },
    ],
  },
  {
    id: 'product',
    label: '상품관리',
    children: [
      { path: '/product/category', label: '카테고리관리' },
      { path: '/product/master', label: '상품마스터관리' },
      { path: '/product/list', label: '상품관리' },
      { path: '/product/base-pharmacy', label: '거점약국상품관리' },
      { path: '/product/sales-rank', label: '상품매출순위' },
      { path: '/product/manufacturer', label: '제조사관리' },
      { path: '/product/price-trend', label: '판매가동향' },
      { path: '/product/sales-support', label: '영업지원관리' },
      { path: '/product/commission', label: '상품수수료' },
      { path: '/product/derma', label: '더마관' },
    ],
  },
  {
    id: 'display',
    label: '전시관리',
    children: [
      { path: '/display/promotion', label: '상품프로모션관리' },
      { path: '/display/corner', label: '코너전시관리' },
      { path: '/display/group-buy', label: '공동구매관리' },
      { path: '/display/vc', label: 'VC전용관관리' },
      {
        path: '/display/otc-special',
        label: 'OTC초특가관리',
        children: [{ path: '/display/otc-special/taoreu', label: '후결제처관리(타오르)' }],
      },
      {
        path: '/display/daewoong',
        label: '대웅전용관테마상품관',
        children: [
          { path: '/display/daewoong/exclusive', label: '전용관 관리' },
          { path: '/display/daewoong/category', label: '카테고리관리' },
        ],
      },
    ],
  },
  {
    id: 'marketing',
    label: '마케팅관리',
    children: [
      { path: '/marketing/mileage', label: '마일리지관리' },
      { path: '/marketing/minus-balance', label: '마이너스잔고' },
      { path: '/marketing/coupon', label: '쿠폰관리' },
      { path: '/marketing/gift', label: '사은품관리' },
      { path: '/marketing/return-coupon', label: '반품쿠폰관리' },
      { path: '/marketing/sms', label: 'SMS관리' },
      { path: '/marketing/deposit-grade', label: '예치금구매등급관리' },
    ],
  },
  {
    id: 'event',
    label: '이벤트관리',
    children: [
      { path: '/event/notification', label: '이벤트알림관리' },
      { path: '/event/membership', label: 'The 멤버십' },
    ],
  },
  {
    id: 'order',
    label: '주문관리',
    children: [
      { path: '/order/status', label: '주문현황' },
      { path: '/order/payment', label: '결제관리' },
      { path: '/order/deposit', label: '예치금관리' },
      { path: '/order/refund', label: '환불관리' },
    ],
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

function hasNestedChildren(
  sub: SubMenuItem
): sub is SubMenuItem & { children: { path: string; label: string }[] } {
  return 'children' in sub && Array.isArray(sub.children) && sub.children.length > 0
}

export default function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const location = useLocation()
  const [openIds, setOpenIds] = useState<string[]>(['order'])
  const [openNestedIds, setOpenNestedIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleNested = (id: string) => {
    setOpenNestedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const isSubActive = (item: MenuItem) => {
    if (!item.children) return false
    return item.children.some((c) => {
      if (location.pathname === c.path) return true
      if (hasNestedChildren(c) && c.children.some((d) => location.pathname === d.path)) return true
      return false
    })
  }

  return (
    <aside className={`${styles.aside} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.sectionTitle}>ADMINISTRATOR</div>
      <nav className={styles.nav}>
        {menuData.map((item) => {
          const hasChildren = item.children && item.children.length > 0
          const isOpen = openIds.includes(item.id)
          const isActive = hasChildren && isSubActive(item)

          return (
            <div key={item.id} className={styles.menuGroup}>
              {hasChildren ? (
                <>
                  <button
                    type="button"
                    className={`${styles.menuRow} ${isActive ? styles.active : ''}`}
                    onClick={() => toggle(item.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? '메뉴 접기' : '메뉴 펼치기'}
                  >
                    <span className={styles.menuLabel}>{item.label}</span>
                    <span className={styles.arrowWrapper} aria-hidden>
                      <span className={`${styles.arrow} ${isOpen ? styles.arrowDown : ''}`}>
                        ›
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <ul className={styles.subMenu}>
                      {item.children!.map((sub) => {
                        if (hasNestedChildren(sub)) {
                          const nestedId = `${item.id}-${sub.path}`
                          const nestedOpen = openNestedIds.includes(nestedId)
                          return (
                            <li key={sub.path} className={styles.subItemWithNested}>
                              <div
                                className={styles.subRow}
                                role="button"
                                tabIndex={0}
                                onClick={() => toggleNested(nestedId)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    toggleNested(nestedId)
                                  }
                                }}
                                aria-expanded={nestedOpen}
                                aria-label={nestedOpen ? '접기' : '펼치기'}
                              >
                                <NavLink
                                  to={sub.path}
                                  className={({ isActive: active }) =>
                                    `${styles.subLink} ${active ? styles.subActive : ''}`
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {sub.label}
                                </NavLink>
                                <span className={`${styles.arrow} ${nestedOpen ? styles.arrowDown : ''}`} aria-hidden>
                                  ›
                                </span>
                              </div>
                              {nestedOpen && (
                                <ul className={styles.nestedMenu}>
                                  {sub.children.map((n) => (
                                    <li key={n.path}>
                                      <NavLink
                                        to={n.path}
                                        className={({ isActive: active }) =>
                                          `${styles.nestedLink} ${active ? styles.subActive : ''}`
                                        }
                                      >
                                        {n.label}
                                      </NavLink>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        }
                        return (
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
                        )
                      })}
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
