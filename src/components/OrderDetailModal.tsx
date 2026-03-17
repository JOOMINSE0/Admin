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

type PartialCancelRecord = {
  id: string
  supplierName: string
  productSpec: string
  manufacturer: string
  sellingPrice: string
  orderQty: string
  cancelReturnQty: string
  depositAccum: string
  mileageAccum: string
  cardCancelAmount: string
}

type PartialCancelRowInput = { accumType: string; reason: string; cancelQty: string; accumAmount: string }

const ACCUM_TYPE_OPTIONS = ['선택', '부분취소', '판매가조정', '낱알반품', '배송비'] as const
const PARTIAL_CANCEL_REASON_OPTIONS = ['선택', '재고부족', '고객요청'] as const

export default function OrderDetailModal({ detail, onClose, currentUserName = '관리자1' }: OrderDetailModalProps) {
  const [openSuppliers, setOpenSuppliers] = useState<Set<string>>(new Set())
  const [memos, setMemos] = useState<{ id: string; authorName: string; content: string }[]>([])
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')
  const [showPartialCancelForm, setShowPartialCancelForm] = useState(false)
  const [partialCancelRecords, setPartialCancelRecords] = useState<PartialCancelRecord[]>([])
  const [partialCancelInputs, setPartialCancelInputs] = useState<Record<number, PartialCancelRowInput>>({})

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

  const openPartialCancelForm = () => {
    setPartialCancelInputs({})
    setShowPartialCancelForm(true)
  }

  const closePartialCancelForm = () => {
    setShowPartialCancelForm(false)
    setPartialCancelInputs({})
  }

  const setPartialCancelInput = (index: number, field: keyof PartialCancelRowInput, value: string) => {
    setPartialCancelInputs((prev) => ({
      ...prev,
      [index]: {
        accumType: prev[index]?.accumType ?? '선택',
        reason: prev[index]?.reason ?? '',
        cancelQty: prev[index]?.cancelQty ?? '',
        accumAmount: prev[index]?.accumAmount ?? '',
        [field]: value,
      },
    }))
  }

  const savePartialCancel = () => {
    if (!detail) return
    const newRecords: PartialCancelRecord[] = []
    detail.products.forEach((p, index) => {
      const row = partialCancelInputs[index]
      if (!row) return
      const cancelQty = row.cancelQty.trim()
      const accumAmount = row.accumAmount.trim()
      const reason = row.reason.trim()
      if (!cancelQty && !accumAmount && (!reason || reason === '선택')) return
      const cancelNum = parseInt(cancelQty, 10) || 0
      const accumNum = parseInt(String(accumAmount).replace(/[,\s원]/g, ''), 10) || 0
      newRecords.push({
        id: `pc-${detail.orderNo}-${Date.now()}-${index}`,
        supplierName: p.supplierName,
        productSpec: p.productSpec,
        manufacturer: p.manufacturer,
        sellingPrice: p.sellingPrice,
        orderQty: p.orderQty,
        cancelReturnQty: `${cancelNum} 개`,
        depositAccum: `${accumNum.toLocaleString()} 원`,
        mileageAccum: '0 원',
        cardCancelAmount: '0 원',
      })
    })
    if (newRecords.length > 0) {
      setPartialCancelRecords((prev) => [...prev, ...newRecords])
    }
    closePartialCancelForm()
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
            <button type="button" className={styles.btnPartialCancel} onClick={openPartialCancelForm}>부분취소</button>
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
          {showPartialCancelForm && (
            <div className={styles.partialCancelForm}>
              <div className={styles.partialCancelGuidance}>
                <ul>
                  <li>* [부분취소]는 발송완료전인 상품에 대해서 예치금을 지급할 수 있습니다. 해당상품의 취소 수량을 입력후에 &apos;추가&apos; 버튼을 클릭해 주세요.</li>
                  <li>* [낱알반품][판매가조정]은 발송완료후의 상품에 대해서 예치금을 지급할 수 있습니다. 해당상품의 적립금액을 입력후에 &apos;추가&apos; 버튼을 클릭해 주세요.</li>
                  <li>* 단, 적립금액은 취소가능수량 * 주문단가를 초과할 수 없습니다. [판매가조정]은 주문수량으로 나눈 값이 소수점이하 가격으로 입력이 불가능합니다.</li>
                  <li>* [낱알반품]을 했을 경우, 해당 상품은 반품이 불가능하며, 반품이 안된 상품에 한해서 낱알반품을 받을 수 있습니다.</li>
                  <li>* [판매가조정]은 반품, 낱알반품이 발생하지 않은 경우에만 판매가조정이 가능합니다.</li>
                  <li>* 배송비에 대한 적립은 배송비가 발생한 주문에 대해서 가능합니다.</li>
                </ul>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.partialCancelTable}>
                  <thead>
                    <tr>
                      <th>선택</th>
                      <th>주문번호</th>
                      <th>공급처</th>
                      <th>자체상품번호</th>
                      <th>상품명</th>
                      <th>주문단가</th>
                      <th>주문</th>
                      <th>가능</th>
                      <th>적립구분</th>
                      <th>부분취소사유</th>
                      <th>취소</th>
                      <th>적립금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.products.map((p, index) => (
                      <tr key={`pc-row-${index}`}>
                        <td><input type="checkbox" defaultChecked /></td>
                        <td>{detail.orderNo}</td>
                        <td>{p.supplierName}</td>
                        <td>{1003432349 + index}</td>
                        <td>{p.productSpec}</td>
                        <td>{p.sellingPrice}</td>
                        <td>{p.orderQty}</td>
                        <td>40</td>
                        <td>
                          <select
                            className={styles.partialCancelSelect}
                            value={partialCancelInputs[index]?.accumType ?? '선택'}
                            onChange={(e) => setPartialCancelInput(index, 'accumType', e.target.value)}
                          >
                            {ACCUM_TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className={styles.partialCancelSelect}
                            value={partialCancelInputs[index]?.reason ?? '선택'}
                            onChange={(e) => setPartialCancelInput(index, 'reason', e.target.value)}
                          >
                            {PARTIAL_CANCEL_REASON_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.partialCancelInput}
                            value={partialCancelInputs[index]?.cancelQty ?? ''}
                            onChange={(e) => setPartialCancelInput(index, 'cancelQty', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.partialCancelInput}
                            value={partialCancelInputs[index]?.accumAmount ?? ''}
                            onChange={(e) => setPartialCancelInput(index, 'accumAmount', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.partialCancelActions}>
                <button type="button" className={styles.btnPartialCancelSubmit} onClick={savePartialCancel}>저장</button>
                <button type="button" className={styles.btnPartialCancelCancel} onClick={closePartialCancelForm}>취소</button>
              </div>
            </div>
          )}

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

            {(() => {
              const totalCostDiscount = (detail.supplierSummary ?? []).reduce((sum, s) => {
                const v = parseInt(String(s.costDiscount || '0').replace(/[원,\s]/g, ''), 10)
                return sum + (Number.isNaN(v) ? 0 : v)
              }, 0)
              const orderAmount = detail.totalOrderAmount
              const totalPayment = orderAmount - totalCostDiscount
              return (
                <div className={styles.paymentCallout}>
                  주문금액({orderAmount.toLocaleString()}원) - 비용할인({totalCostDiscount.toLocaleString()}원) = 총결제금액 {totalPayment.toLocaleString()}원
                </div>
              )
            })()}

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
                              <td className={styles.cellAllowWrap}>
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

          {partialCancelRecords.length > 0 && (
            <div className={styles.contentSection}>
              <div className={styles.sectionTitleBar}>
                <span className={styles.sectionTitleIconPartial} aria-hidden />
                <span className={styles.sectionTitle}>부분취소 내역</span>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>공급사명</th>
                        <th>상품명/규격/단위</th>
                        <th>제조사</th>
                        <th>판매가</th>
                        <th>주문수량</th>
                        <th>취소/반품 수량</th>
                        <th>예치금 적립금액</th>
                        <th>마일리지 적립금액</th>
                        <th>카드취소액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partialCancelRecords.map((r) => (
                        <tr key={r.id}>
                          <td>{r.supplierName}</td>
                          <td>{r.productSpec}</td>
                          <td>{r.manufacturer}</td>
                          <td>{r.sellingPrice}</td>
                          <td>{r.orderQty}</td>
                          <td>{r.cancelReturnQty}</td>
                          <td>{r.depositAccum}</td>
                          <td>{r.mileageAccum}</td>
                          <td>{r.cardCancelAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const totalDeposit = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.depositAccum).replace(/[,\s원]/g, ''), 10), 0)
                  const totalMileage = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.mileageAccum).replace(/[,\s원]/g, ''), 10), 0)
                  const totalCard = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.cardCancelAmount).replace(/[,\s원]/g, ''), 10), 0)
                  const totalAccum = totalDeposit + totalMileage + totalCard
                  return (
                    <div className={styles.partialCancelSummary}>
                      총적립금액 {totalAccum.toLocaleString()}원 (총예치금적립 {totalDeposit.toLocaleString()}원, 회수택배비사용 0원, 총마일리지적립 {totalMileage.toLocaleString()}원, 총카드취소액 {totalCard.toLocaleString()}원)
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
