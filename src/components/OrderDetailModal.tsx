import { useState, useEffect } from 'react'
import styles from './OrderDetailModal.module.css'

export type OrderDetailData = {
  orderNo: string
  sapOrderNo: string
  orderDateTime: string
  orderStatus: string
  orderStatusDate: string
  totalOrderAmount: number
  orderIdEmail: string
  paymentMethod: string
  products: {
    supplierName: string
    expectedDeliveryDate: string
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
  }[]
  customer: {
    recipient: string
    contact: string
    businessNo: string
    medicalCode: string
    address: string
  }
  vendorMessage: string
  adminMemos?: { id: string; authorName: string; content: string }[]
}

type OrderDetailModalProps = {
  detail: OrderDetailData | null
  onClose: () => void
  currentUserName?: string
}

type SectionId = 'detail' | 'customer' | 'message' | 'adminMemo'

export default function OrderDetailModal({ detail, onClose, currentUserName = '관리자1' }: OrderDetailModalProps) {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set())
  const [memos, setMemos] = useState<{ id: string; authorName: string; content: string }[]>([])
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')

  useEffect(() => {
    setMemos(detail?.adminMemos ?? [])
    setEditingMemoId(null)
    setNewMemoContent('')
  }, [detail?.orderNo, detail?.adminMemos])

  const toggleSection = (id: SectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteMemo = (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    if (editingMemoId === id) setEditingMemoId(null)
  }

  const handleEditStart = (id: string, content: string) => {
    setEditingMemoId(id)
    setEditingContent(content)
  }

  const handleEditSave = () => {
    if (!editingMemoId) return
    setMemos((prev) =>
      prev.map((m) => (m.id === editingMemoId ? { ...m, content: editingContent } : m))
    )
    setEditingMemoId(null)
    setEditingContent('')
  }

  const handleEditCancel = () => {
    setEditingMemoId(null)
    setEditingContent('')
  }

  const handleAddMemo = () => {
    const content = newMemoContent.trim()
    if (!content) return
    setMemos((prev) => [
      ...prev,
      { id: String(Date.now()), authorName: currentUserName, content },
    ])
    setNewMemoContent('')
  }

  if (!detail) return null

  const status = detail.orderStatus
  const statusActionButton =
    status === '주문 완료' ? { label: '결제완료', className: styles.btnShip } :
    status === '결제완료' ? { label: '발송 준비중', className: styles.btnShip } :
    status === '발송 준비중' ? { label: '발송완료', className: styles.btnShip } :
    status === '발송 완료' ? { label: '발송 준비중', className: styles.btnShip } :
    null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            상세주문정보
          </h2>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrint}>프린트하기</button>
            <button type="button" className={styles.btnPartialCancel}>부분취소</button>
            <button type="button" className={styles.btnOrderCancel}>주문취소</button>
            {statusActionButton && (
              <button type="button" className={statusActionButton.className}>
                {statusActionButton.label}
              </button>
            )}
            <button type="button" className={styles.btnClose} onClick={onClose} aria-label="닫기">×</button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.contentSection}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection('detail')}
              aria-expanded={openSections.has('detail')}
            >
              <span className={styles.sectionTitle}>상세주문정보</span>
              <span className={`${styles.sectionArrow} ${openSections.has('detail') ? styles.sectionArrowOpen : ''}`}>›</span>
            </button>
            {openSections.has('detail') && (
            <div className={styles.sectionBody}>
            <table className={styles.summaryTable}>
              <tbody>
                <tr>
                  <th>주문 번호</th>
                  <td className={styles.orderNoLink}>{detail.orderNo}</td>
                  <th>총 주문금액</th>
                  <td>{detail.totalOrderAmount.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>SAP주문번호</th>
                  <td>{detail.sapOrderNo}</td>
                  <th></th>
                  <td></td>
                </tr>
                <tr>
                  <th>주문일시</th>
                  <td>{detail.orderDateTime}</td>
                  <th>주문아이디/이메일</th>
                  <td>{detail.orderIdEmail}</td>
                </tr>
                <tr>
                  <th>주문상태</th>
                  <td>{detail.orderStatus} ({detail.orderStatusDate})</td>
                  <th>결제방식</th>
                  <td>{detail.paymentMethod}</td>
                </tr>
                <tr>
                  <th>공급사명</th>
                  <td>{detail.products[0]?.supplierName ?? '-'}</td>
                  <th>배송 예정일</th>
                  <td>{detail.products[0]?.expectedDeliveryDate ?? '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.tableWrap}>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>구분</th>
                  <th>상품명/규격/단위</th>
                  <th>제조사</th>
                  <th>판매가</th>
                  <th>주문수량</th>
                  <th>소계금액</th>
                </tr>
              </thead>
              <tbody>
                {detail.products.map((p, i) => (
                  <tr key={i}>
                    <td>{p.category}</td>
                    <td>{p.productSpec}</td>
                    <td>{p.manufacturer}</td>
                    <td>{p.sellingPrice}</td>
                    <td>{p.orderQty}</td>
                    <td>{p.subtotal}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </div>
            )}
          </div>

          <div className={styles.contentSection}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection('customer')}
              aria-expanded={openSections.has('customer')}
            >
              <span className={styles.sectionTitle}>주문 고객정보</span>
              <span className={`${styles.sectionArrow} ${openSections.has('customer') ? styles.sectionArrowOpen : ''}`}>›</span>
            </button>
            {openSections.has('customer') && (
            <div className={styles.sectionBody}>
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
            )}
          </div>

          <div className={styles.contentSection}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection('message')}
              aria-expanded={openSections.has('message')}
            >
              <span className={styles.sectionTitle}>업체 전달 메세지</span>
              <span className={`${styles.sectionArrow} ${openSections.has('message') ? styles.sectionArrowOpen : ''}`}>›</span>
            </button>
            {openSections.has('message') && (
            <div className={styles.sectionBody}>
            <table className={styles.customerTable}>
              <tbody>
                <tr>
                  <th>업체 전달 메세지</th>
                  <td className={styles.messageContent}>{detail.vendorMessage}</td>
                </tr>
              </tbody>
            </table>
            </div>
            )}
          </div>

          <div className={styles.contentSection}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => toggleSection('adminMemo')}
              aria-expanded={openSections.has('adminMemo')}
            >
              <span className={styles.sectionTitle}>관리자 메모</span>
              <span className={`${styles.sectionArrow} ${openSections.has('adminMemo') ? styles.sectionArrowOpen : ''}`}>›</span>
            </button>
            {openSections.has('adminMemo') && (
            <div className={styles.sectionBody}>
              <p className={styles.memoDesc}>운영팀과 소통을 위한 메모입니다. 작성한 메모만 수정·삭제할 수 있습니다.</p>
              <ul className={styles.memoList}>
                {memos.map((memo) => (
                  <li key={memo.id} className={styles.memoItem}>
                    <div className={styles.memoMeta}>
                      <span className={styles.memoAuthor}>{memo.authorName}</span>
                      {memo.authorName === currentUserName && editingMemoId !== memo.id && (
                        <span className={styles.memoActions}>
                          <button type="button" className={styles.btnMemoEdit} onClick={() => handleEditStart(memo.id, memo.content)}>수정</button>
                          <button type="button" className={styles.btnMemoDelete} onClick={() => handleDeleteMemo(memo.id)}>삭제</button>
                        </span>
                      )}
                    </div>
                    {editingMemoId === memo.id ? (
                      <div className={styles.memoEditWrap}>
                        <textarea
                          className={styles.memoTextarea}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={3}
                        />
                        <div className={styles.memoEditActions}>
                          <button type="button" className={styles.btnMemoSave} onClick={handleEditSave}>저장</button>
                          <button type="button" className={styles.btnMemoCancel} onClick={handleEditCancel}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.memoContent}>{memo.content}</div>
                    )}
                  </li>
                ))}
              </ul>
              <div className={styles.memoAddWrap}>
                <textarea
                  className={styles.memoTextarea}
                  placeholder="메모를 입력하세요"
                  value={newMemoContent}
                  onChange={(e) => setNewMemoContent(e.target.value)}
                  rows={3}
                />
                <button type="button" className={styles.btnMemoAdd} onClick={handleAddMemo}>메모 등록</button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
