import { useState } from 'react'
import CollapsibleSection from '../components/CollapsibleSection'
import styles from './OrderPage.module.css'

const breadcrumb = ['홈', '주문관리', '주문현황']
const infoMessage = 'CRM 재고확인구간, 결제정보 미포함'

const mockOrders = [
  {
    id: 1,
    no: 1,
    orderNo: 'PO1017583430',
    productName: '빵보뜨테스트',
    pharmacy: '-',
    orderDate: '2026.03.12',
    customerName: '테스트고객',
    deliveryMethod: '직배송',
    orderAmount: 10000,
    deliveryFee: 0,
    supplyPrice: 9000,
    tax: 1000,
    mileage: 0,
    partialCancel: 0,
    orderer: '테스트',
    finalAmount: 10000,
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: i + 2,
    no: i + 2,
    orderNo: `PO1017583${430 + i}`,
    productName: `상품${i + 1}`,
    pharmacy: '-',
    orderDate: '2026.03.12',
    customerName: '고객' + (i + 1),
    deliveryMethod: '직배송',
    orderAmount: 15000 + i * 1000,
    deliveryFee: 0,
    supplyPrice: 13000,
    tax: 2000,
    mileage: 0,
    partialCancel: 0,
    orderer: '주문자',
    finalAmount: 15000 + i * 1000,
  })),
]

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function OrderStatus() {
  const [tab, setTab] = useState<'order' | 'bundle'>('order')
  const [dateFrom, setDateFrom] = useState('2026-03-06')
  const [dateTo, setDateTo] = useState('2026-03-13')

  const setQuickDate = (type: 'today' | '1day' | '1week' | '1month') => {
    const today = new Date()
    const toStr = formatDate(today)
    let from: Date
    if (type === 'today') {
      from = today
    } else if (type === '1day') {
      from = new Date(today)
      from.setDate(from.getDate() - 1)
    } else if (type === '1week') {
      from = new Date(today)
      from.setDate(from.getDate() - 6)
    } else {
      from = new Date(today)
      from.setMonth(from.getMonth() - 1)
    }
    setDateFrom(formatDate(from))
    setDateTo(toStr)
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        {breadcrumb.map((item, i) => (
          <span key={item}>
            {i > 0 && <span className={styles.breadcrumbSep}> &gt; </span>}
            {item}
          </span>
        ))}
      </div>
      <h1 className={styles.pageTitle}>
        <span className={styles.pageTitleIcon}>📋</span> 주문현황
      </h1>

      <div className={styles.infoBar}>
        <span className={styles.infoIcon}>ℹ️</span> {infoMessage}
      </div>

      <CollapsibleSection title="주문현황" defaultOpen={true}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'order' ? styles.tabActive : ''}`}
            onClick={() => setTab('order')}
          >
            주문기준
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'bundle' ? styles.tabActive : ''}`}
            onClick={() => setTab('bundle')}
          >
            묶음주문기준
          </button>
        </div>
        <div className={styles.filterRow}>
          <label className={styles.filterLabel}>주문일자</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.input}
          />
          <span className={styles.rangeSep}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={styles.input}
          />
          <div className={styles.quickDates}>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('today')}>오늘</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1day')}>1일</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1week')}>1주</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1month')}>1개월</button>
          </div>
        </div>
        <div className={styles.filterBlock}>
          <div className={styles.filterTopRow}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>공급사</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
            <button type="button" className={styles.btnOrange}>가나다순</button>
          </div>
          <div className={styles.filterSearchRow}>
            <label className={styles.filterLabel}>검색어</label>
            <div className={styles.searchGroup}>
              <span className={styles.searchTypeLabel}>검색타입</span>
              <select className={styles.select}><option>고객명</option></select>
              <input type="text" className={styles.input} placeholder="" />
            </div>
            <div className={styles.searchGroup}>
              <span className={styles.filterLabel}>검색어</span>
              <input type="text" className={styles.input} placeholder="" />
            </div>
          </div>
          <div className={styles.filterRow3}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>예치금</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>회원유형</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>선결제구분</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
          </div>
          <div className={styles.filterRowSingle}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>플러스전용관</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
          </div>
          <div className={styles.filterBottomRow}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>주문상태</label>
              <select className={styles.select}><option>전체</option></select>
            </div>
            <div className={styles.filterSearchRow}>
              <label className={styles.filterLabel}>검색어</label>
              <div className={styles.searchGroup}>
                <span className={styles.searchTypeLabel}>검색타입</span>
                <select className={styles.select}><option>약국명</option></select>
                <input type="text" className={styles.input} placeholder="" />
              </div>
              <div className={styles.searchGroup}>
                <span className={styles.filterLabel}>검색어</span>
                <input type="text" className={styles.input} placeholder="" />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.filterActions}>
          <button type="button" className={styles.btnSecondary}>검색 초기화</button>
          <button type="button" className={styles.btnPrimary}>검색하기</button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="주문금액" defaultOpen={true}>
        <div className={styles.summaryRow}>
          <span>주문금액 3,430,912 원</span>
          <span>배송비 0 원</span>
          <span>결제금액 3,379,009 원</span>
          <span>가드부분취소 0 원</span>
          <span>최종결제금액 3,379,009 원</span>
        </div>
      </CollapsibleSection>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>📋 주문내역</h2>
          <div className={styles.tableActions}>
            <span className={styles.totalCount}>전체 {mockOrders.length}건</span>
            <button type="button" className={styles.btnExcel}>엑셀 다운로드</button>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>번호</th>
                <th>주문번호</th>
                <th>상품명</th>
                <th>약국</th>
                <th>주문일시</th>
                <th>고객명</th>
                <th>배송방식</th>
                <th>주문금액</th>
                <th>배송비</th>
                <th>공급가</th>
                <th>부가세</th>
                <th>마일리지</th>
                <th>부분취소</th>
                <th>주문자</th>
                <th>최종결제금액</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((row, idx) => (
                <tr key={row.id} className={idx === 0 ? styles.rowHighlight : ''}>
                  <td><input type="checkbox" /></td>
                  <td>{row.no}</td>
                  <td>{row.orderNo}</td>
                  <td>{row.productName}</td>
                  <td>{row.pharmacy}</td>
                  <td>{row.orderDate}</td>
                  <td>{row.customerName}</td>
                  <td>{row.deliveryMethod}</td>
                  <td>{row.orderAmount.toLocaleString()}</td>
                  <td>{row.deliveryFee}</td>
                  <td>{row.supplyPrice.toLocaleString()}</td>
                  <td>{row.tax.toLocaleString()}</td>
                  <td>{row.mileage}</td>
                  <td>{row.partialCancel}</td>
                  <td>{row.orderer}</td>
                  <td>{row.finalAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
