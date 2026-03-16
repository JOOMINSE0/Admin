import styles from './OrderDetailModal.module.css'

export type OrderDetailData = {
  orderNo: string
  orderDateTime: string
  orderStatus: string
  orderStatusDate: string
  totalOrderAmount: number
  orderIdEmail: string
  paymentMethod: string
  products: {
    supplierName: string
    category: string
    productSpec: string
    manufacturer: string
    sellingPrice: string
    orderQty: string
    subtotal: string
    shippingCost: string
  }[]
  supplierSummary: {
    supplier: string
    totalAmount: string
    shippingCost: string
    otcDiscount: string
    costDiscount: string
    mileageUsed: string
  }[]
  paymentSummary: {
    minusBalance: string
    supplierCoupon: string
    paymentAmount: string
    earnedMileage: string
    expectedDeposit: string
    orderStatus: string
  }[]
  customer: {
    recipient: string
    contact: string
    businessNo: string
    medicalCode: string
    address: string
  }
  vendorMessage: string
}

type OrderDetailModalProps = {
  detail: OrderDetailData | null
  onClose: () => void
}

export default function OrderDetailModal({ detail, onClose }: OrderDetailModalProps) {
  if (!detail) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span className={styles.titleIcon}>🛒</span>
            상세주문정보
          </h2>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrint}>🖨 프린트하기</button>
            <button type="button" className={styles.btnPartialCancel}>✕ 부분취소</button>
            <button type="button" className={styles.btnOrderCancel}>− 주문취소</button>
            <button type="button" className={styles.btnShip}>✓ 발송준비중처리</button>
            <button type="button" className={styles.btnClose} onClick={onClose} aria-label="닫기">×</button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.infoGrid}>
            <div className={styles.infoBlock}>
              <label>주문 번호</label>
              <span className={styles.orderNoLink}>{detail.orderNo}</span>
            </div>
            <div className={styles.infoBlock}>
              <label>총 주문금액</label>
              <span>{detail.totalOrderAmount.toLocaleString()}</span>
            </div>
            <div className={styles.infoBlock}>
              <label>주문일시</label>
              <span>{detail.orderDateTime}</span>
            </div>
            <div className={styles.infoBlock}>
              <label>주문아이디/이메일</label>
              <span>{detail.orderIdEmail}</span>
            </div>
            <div className={styles.infoBlock}>
              <label>주문상태</label>
              <span>{detail.orderStatus} ({detail.orderStatusDate})</span>
            </div>
            <div className={styles.infoBlock}>
              <label>결제방식</label>
              <span>{detail.paymentMethod}</span>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>공급사명</th>
                  <th>구분</th>
                  <th>상품명/규격/단위</th>
                  <th>제조사</th>
                  <th>판매가</th>
                  <th>주문수량</th>
                  <th>소계금액</th>
                  <th>배송비</th>
                </tr>
              </thead>
              <tbody>
                {detail.products.map((p, i) => (
                  <tr key={i}>
                    <td>{p.supplierName}</td>
                    <td>{p.category}</td>
                    <td>{p.productSpec}</td>
                    <td>{p.manufacturer}</td>
                    <td>{p.sellingPrice}</td>
                    <td>{p.orderQty}</td>
                    <td>{p.subtotal}</td>
                    <td>{p.shippingCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>공급사</th>
                  <th>주문합계금액</th>
                  <th>배송비</th>
                  <th>OTC수금할인금액</th>
                  <th>비용할인</th>
                  <th>사용마일리지</th>
                </tr>
              </thead>
              <tbody>
                {detail.supplierSummary.map((s, i) => (
                  <tr key={i}>
                    <td>{s.supplier}</td>
                    <td>{s.totalAmount}</td>
                    <td>{s.shippingCost}</td>
                    <td>{s.otcDiscount}</td>
                    <td>{s.costDiscount}</td>
                    <td>{s.mileageUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>마이너스잔고사용액</th>
                  <th>공급사쿠폰</th>
                  <th>결제금액</th>
                  <th>적립마일리지</th>
                  <th>적립예정예치금</th>
                  <th>주문상태</th>
                </tr>
              </thead>
              <tbody>
                {detail.paymentSummary.map((p, i) => (
                  <tr key={i}>
                    <td>{p.minusBalance}</td>
                    <td>{p.supplierCoupon}</td>
                    <td>{p.paymentAmount}</td>
                    <td>{p.earnedMileage}</td>
                    <td>{p.expectedDeposit}</td>
                    <td>{p.orderStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.customerSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionTitleIcon}>👤</span>
              주문 고객정보
            </div>
            <table className={styles.customerTable}>
              <tbody>
                <tr>
                  <th>받으시는 분</th>
                  <td>{detail.customer.recipient}</td>
                </tr>
                <tr>
                  <th>연락처 / 휴대폰번호</th>
                  <td>{detail.customer.contact}</td>
                </tr>
                <tr>
                  <th>사업자번호</th>
                  <td>{detail.customer.businessNo}</td>
                </tr>
                <tr>
                  <th>요양기관기호</th>
                  <td>{detail.customer.medicalCode}</td>
                </tr>
                <tr>
                  <th>주소</th>
                  <td>{detail.customer.address}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.messageSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.sectionTitleRect}>💬</span>
              업체 전달 메세지
            </div>
            <div className={styles.messageContent}>{detail.vendorMessage}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
