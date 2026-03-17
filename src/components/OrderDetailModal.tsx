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

export default function OrderDetailModal({ detail, onClose, currentUserName = '관리자1' }: OrderDetailModalProps) {
  const [openSuppliers, setOpenSuppliers] = useState<Set<string>>(new Set())
  const [memos, setMemos] = useState<{ id: string; authorName: string; content: string }[]>([])
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')

  useEffect(() => {
    setMemos(detail?.adminMemos ?? [])
    setEditingMemoId(null)
    setNewMemoContent('')
    setOpenSuppliers(new Set())
  }, [detail?.orderNo, detail?.adminMemos, detail?.products])

  const toggleSupplier = (name: string) => {
    setOpenSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
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
            {(detail.orderStatus === '주문 완료' || detail.orderStatus === '결제완료') && (
              <button type="button" className={styles.btnOrderCancel}>주문취소</button>
            )}
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
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>상세주문정보</span>
            </div>
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
                  <td colSpan={3} className={styles.sapOrderNoCell}>{detail.sapOrderNo}</td>
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
              </tbody>
            </table>

            {Object.entries(
              detail.products.reduce<Record<string, typeof detail.products>>((acc, p) => {
                if (!acc[p.supplierName]) acc[p.supplierName] = []
                acc[p.supplierName].push(p)
                return acc
              }, {})
            ).map(([supplierName, products]) => {
              const isOpen = openSuppliers.has(supplierName)
              const costDiscount =
                detail.supplierSummary?.find((s) => s.supplier === supplierName)?.costDiscount ?? '-'
              const expectedDelivery = products[0]?.expectedDeliveryDate ?? '-'
              return (
                <div key={supplierName} className={styles.supplierBlock}>
                  <div className={styles.supplierRow}>
                    <button
                      type="button"
                      className={styles.supplierHeader}
                      onClick={() => toggleSupplier(supplierName)}
                      aria-expanded={isOpen}
                    >
                      <span className={styles.supplierName}>{supplierName}</span>
                      <span
                        className={`${styles.supplierArrow} ${
                          isOpen ? styles.supplierArrowOpen : ''
                        }`}
                      >
                        ›
                      </span>
                    </button>
                    <div className={styles.supplierShippingCol}>
                      <span className={styles.supplierShippingLabel}>배송 정보</span>
                      <div className={styles.supplierShippingBody}>
                        <span>예정일 {expectedDelivery}</span>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className={styles.tableWrap}>
                      <table className={styles.detailTable}>
                        <thead>
                          <tr>
                            <th>공급사</th>
                            <th>구분</th>
                            <th>상품명/규격/단위</th>
                            <th>판매가</th>
                            <th>주문수량</th>
                            <th>비용할인</th>
                            <th>소계금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p, i) => (
                            <tr key={`${supplierName}-${i}`}>
                              <td>{supplierName ?? '-'}</td>
                              <td>{p.category ?? '-'}</td>
                              <td>
                                <div className={styles.productNameCell}>{p.productSpec ?? '-'}</div>
                                {(p.manufacturer ?? '').trim() && (
                                  <div className={styles.productManufacturer}>{p.manufacturer}</div>
                                )}
                              </td>
                              <td>{p.sellingPrice ?? '-'}</td>
                              <td>{p.orderQty ?? '-'}</td>
                              <td>{costDiscount}</td>
                              <td>{p.subtotal ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>주문 고객정보</span>
            </div>
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
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>업체 전달 메세지</span>
            </div>
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
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>관리자 메모</span>
            </div>
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
          </div>
        </div>
      </div>
    </div>
  )
}
