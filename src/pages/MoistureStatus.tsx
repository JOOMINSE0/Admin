import { useState } from 'react'
import CollapsibleSection from '../components/CollapsibleSection'
import styles from './OrderPage.module.css'

const breadcrumb = ['홈', '주문관리', '수분현황']
const infoMessage = 'CRM 매출이력은 선지급/후불결제/유물결제로 조회!!'
const infoMessage2 = '주문취소 / 연체완료결제확인 / 반품접수회수'

const mockOrders = [
  {
    id: 1,
    no: 1,
    orderNo: 'PO1017233400',
    supplier: '수수료작성부',
    productName: '뉴아트테스트2, 퓨어스킨젤',
    region: '-',
    orderDate: '2020.03.12',
    deliveryNav: '-',
    orderAmount: 50000,
    deliveryFee: 0,
    cancel: 0,
    transferFee: 0,
    tax: 5000,
  },
  ...Array.from({ length: 14 }, (_, i) => ({
    id: i + 2,
    no: i + 2,
    orderNo: `PO1017233${400 + i}`,
    supplier: '신체',
    productName: `상품${i + 1}`,
    region: '-',
    orderDate: '2020.03.12',
    deliveryNav: '-',
    orderAmount: 30000 + i * 1000,
    deliveryFee: 0,
    cancel: 0,
    transferFee: 0,
    tax: 3000,
  })),
]

export default function MoistureStatus() {
  const [tab, setTab] = useState<'order' | 'bundle'>('order')
  const [dateFrom, setDateFrom] = useState('2020-03-09')
  const [dateTo, setDateTo] = useState('2020-03-13')

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
        <span className={styles.pageTitleIcon}>📋</span> 수분현황
      </h1>

      <div className={styles.infoBar}>
        <span className={styles.infoIcon}>⚠️</span> {infoMessage}
      </div>

      <CollapsibleSection title="수분관련" defaultOpen={true}>
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
            <button type="button" className={styles.quickBtn}>오늘</button>
            <button type="button" className={styles.quickBtn}>7일</button>
            <button type="button" className={styles.quickBtn}>달</button>
            <button type="button" className={styles.quickBtn}>3개월</button>
            <button type="button" className={styles.quickBtn}>1년</button>
          </div>
        </div>
        <div className={styles.filterGrid}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>요구분</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>공급사</label>
            <select className={styles.select}><option>신체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>검색어</label>
            <input type="text" className={styles.input} placeholder="검색" />
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>회원유형</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>예치금</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>선지급구분</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>플러스전용</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>주문상태</label>
            <select className={styles.select}><option>전체</option></select>
          </div>
        </div>
        <div className={styles.filterActions}>
          <button type="button" className={styles.btnOrange}>가나다순</button>
          <button type="button" className={styles.btnOrange}>초기화</button>
          <button type="button" className={styles.btnPrimary}>검색</button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="주요금액" defaultOpen={true}>
        <div className={styles.summaryRow}>
          <span>주요금액: 3,430,912 량</span>
          <span>배송비: 0 량</span>
          <span>취소: 0 량</span>
          <span>결제금액: 3,379,009 량</span>
          <span>가드부분취소: 0 량</span>
          <span>최종결제금액: 3,379,009 량</span>
        </div>
      </CollapsibleSection>

      <div className={styles.infoBar}>
        <span className={styles.infoIcon}>ℹ️</span> {infoMessage2}
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>📋 주문결과내역</h2>
          <div className={styles.tableActions}>
            <span className={styles.totalCount}>총 {mockOrders.length}건</span>
            <button type="button" className={styles.btnExcel}>엑셀 다운로드</button>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th><input type="checkbox" /></th>
                <th>No.</th>
                <th>주문번호</th>
                <th>공급자</th>
                <th>상품명</th>
                <th>납부국</th>
                <th>주문일시</th>
                <th>배송내비사</th>
                <th>주문금액</th>
                <th>배송비</th>
                <th>취소</th>
                <th>송금수수료</th>
                <th>부가세</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((row) => (
                <tr key={row.id}>
                  <td><input type="checkbox" /></td>
                  <td>{row.no}</td>
                  <td>{row.orderNo}</td>
                  <td>{row.supplier}</td>
                  <td>{row.productName}</td>
                  <td>{row.region}</td>
                  <td>{row.orderDate}</td>
                  <td>{row.deliveryNav}</td>
                  <td>{row.orderAmount.toLocaleString()}</td>
                  <td>{row.deliveryFee}</td>
                  <td>{row.cancel}</td>
                  <td>{row.transferFee}</td>
                  <td>{row.tax.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
