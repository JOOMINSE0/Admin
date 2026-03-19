import { useState, useEffect } from 'react'
import AccumHistoryModal from './AccumHistoryModal'
import styles from './OrderDetailModal.module.css'

/** 이 제약사들에 한해 SAP주문번호 컬럼을 제약사별 서브컬럼으로 표시 (데이터에 없으면 비움) */
const SAP_TARGET_SUPPLIER_NAMES = ['대웅제약', '대웅바이오', '한올바이오파마'] as const

/** 공급사명에서 괄호·접미사 제거 후 비교용 이름 반환 (예: "대웅제약 (도매)" → "대웅제약") */
function normalizeSupplierForSap(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** SAP 문자열에서 오더/납품/빌링 번호 추출 (예: "오더(123) / 납품(456) / 빌링(789)" → { order, delivery, billing }) */
function parseSapOrderNo(raw: string): { order: string; delivery: string; billing: string } {
  const orderMatch = raw.match(/오더\s*\(([^)]+)\)/)
  const deliveryMatch = raw.match(/납품\s*\(([^)]+)\)/)
  const billingMatch = raw.match(/빌링\s*\(([^)]+)\)/)
  return {
    order: orderMatch ? orderMatch[1].trim() : '-',
    delivery: deliveryMatch ? deliveryMatch[1].trim() : '-',
    billing: billingMatch ? billingMatch[1].trim() : '-',
  }
}

/** SAP 라인 마지막 괄호 텍스트 추출 (예: "...(출하완료)" → "출하완료") */
function parseSapLastParenText(line: string): string | null {
  const m = line.match(/\(([^()]+)\)\s*$/)
  return m ? m[1].trim() : null
}

/** SAP 라인 마지막 괄호 텍스트를 주문상태로 대략 매핑 */
function mapSapLastParenToOrderStatus(raw: string): string | null {
  // 출하 단계는 앱의 발송 단계로 매핑
  if (/출하\s*완료/.test(raw) || /출하완료/.test(raw)) return '발송 완료'
  if (/일부\s*완료/.test(raw) || /일부완료/.test(raw)) return '발송 준비중'
  if (/출하/.test(raw) && !/완료/.test(raw)) return '발송 준비중'
  if (/준비/.test(raw) && /출하/.test(raw)) return '발송 준비중'

  // 취소/부분취소 등의 키워드(데이터 포맷이 바뀌어도 최소한의 표시 유지 목적)
  if (/부분/.test(raw) && /취소/.test(raw)) return '부분 취소'
  if (/취소/.test(raw)) return '주문 취소'

  if (/결제\s*완료/.test(raw) || /결제완료/.test(raw)) return '결제완료'
  if (/주문\s*완료/.test(raw) || /주문완료/.test(raw) || /오더\s*완료/.test(raw) || /오더완료/.test(raw)) {
    return '주문 완료'
  }

  return null
}

export function getSupplierOrderStatusFromSap(args: {
  sapOrderNoBySupplier?: Record<string, string>
  supplierName: string
  fallbackOrderStatus: string
}): string {
  const { sapOrderNoBySupplier, supplierName, fallbackOrderStatus } = args
  if (!sapOrderNoBySupplier) return fallbackOrderStatus

  const supplierKey = normalizeSupplierForSap(supplierName)
  const raw = sapOrderNoBySupplier[supplierKey]
  if (!raw || !raw.trim()) return fallbackOrderStatus

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const mapped = lines
    .map((line) => {
      const last = parseSapLastParenText(line)
      if (!last) return null
      return mapSapLastParenToOrderStatus(last)
    })
    .filter((v): v is string => !!v)

  if (mapped.length === 0) return fallbackOrderStatus

  // 완료가 있으면 완료 우선, 그 외에는 준비중/그 다음 순
  if (mapped.includes('발송 완료')) return '발송 완료'
  if (mapped.includes('발송 준비중')) return '발송 준비중'
  if (mapped.includes('부분 취소')) return '부분 취소'
  if (mapped.includes('주문 취소')) return '주문 취소'
  if (mapped.includes('결제완료')) return '결제완료'
  if (mapped.includes('주문 완료')) return '주문 완료'

  return mapped[0] ?? fallbackOrderStatus
}

/** SAP 라인 앞부분에서 OTC/ETC 추출 (예: "OTC(제): ..." → "OTC", "ETC(바): ..." → "ETC") */
function parseSapCategoryFromLine(line: string): 'OTC' | 'ETC' | null {
  const m = line.trim().match(/^(OTC|ETC)/i)
  return m ? (m[1].toUpperCase() as 'OTC' | 'ETC') : null
}

/** 상품 텍스트(상품명/규격 등)에서 [제약 공장 출하(택배)] / [지역 창고 출하(도매 위탁)] 파싱해 출하구분 반환 */
function getShipmentTypeFromProductText(productSpec: string | undefined): '제약공장 출하' | '지역공장 출하' | '' {
  if (!productSpec || !productSpec.trim()) return ''
  const s = productSpec.trim()
  if (/\[제약\s*공장\s*출하/.test(s)) return '제약공장 출하'
  if (/\[지역\s*창고\s*출하/.test(s) || /\[지역\s*공장\s*출하/.test(s)) return '지역공장 출하'
  return ''
}

export type OrderDetailData = {
  orderNo: string
  sapOrderNo: string
  /** 제약사별 SAP주문번호 (키: 공급사명, 값: 해당 SAP번호) */
  sapOrderNoBySupplier?: Record<string, string>
  /** SAP 공급사별 출하구분 배지 (지역/공장) */
  sapShipmentTypeBySupplier?: Record<string, '지역' | '공장'>
  /** SAP 공급사별 구분 (OTC/ETC). 오른쪽에 표시 */
  sapCategoryBySupplier?: Record<string, 'OTC' | 'ETC'>
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
    /** 출하구분: 제약공장 출하(공장) / 지역공장 출하(창고). 정렬 시 공장 우선 */
    shipmentType?: '제약공장 출하' | '지역공장 출하'
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
  /** 주문 취소 버튼 클릭 시 호출 (주문번호 전달). 호출 후 목록/탭 반영을 위해 모달을 닫음 */
  onOrderCancel?: (orderNo: string) => void
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

type PartialCancelRowInput = { accumType: string; reason: string; cancelQty: string }

const ACCUM_TYPE_OPTIONS = ['선택', '부분취소', '판매가조정', '낱알반품', '배송비'] as const
const PARTIAL_CANCEL_REASON_OPTIONS = ['선택', '재고부족', '고객요청'] as const

export default function OrderDetailModal({ detail, onClose, currentUserName = '관리자1', onOrderCancel }: OrderDetailModalProps) {
  const [openSuppliers, setOpenSuppliers] = useState<Set<string>>(new Set())
  const [memos, setMemos] = useState<{ id: string; authorName: string; content: string }[]>([])
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')
  const [showPartialCancelForm, setShowPartialCancelForm] = useState(false)
  const [partialCancelRecords, setPartialCancelRecords] = useState<PartialCancelRecord[]>([])
  const [partialCancelInputs, setPartialCancelInputs] = useState<Record<number, PartialCancelRowInput>>({})
  const [showAccumHistoryModal, setShowAccumHistoryModal] = useState(false)

  useEffect(() => {
    setMemos(detail?.adminMemos ?? [])
    setEditingMemoId(null)
    setNewMemoContent('')
    setOpenSuppliers(new Set())
    setShowPartialCancelForm(false)
    setPartialCancelRecords([])
    setPartialCancelInputs({})
    setShowAccumHistoryModal(false)
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
        [field]: value,
      },
    }))
  }

  const parsePrice = (s: string): number => {
    const n = parseInt(String(s).replace(/[,\s원]/g, ''), 10)
    return Number.isNaN(n) ? 0 : n
  }

  const savePartialCancel = () => {
    if (!detail) return
    const newRecords: PartialCancelRecord[] = []
    detail.products.forEach((p, index) => {
      const row = partialCancelInputs[index]
      if (!row) return
      const cancelQty = row.cancelQty.trim()
      const reason = row.reason.trim()
      if (!cancelQty && (!reason || reason === '선택')) return
      const cancelNum = parseInt(cancelQty, 10) || 0
      const unitPrice = parsePrice(p.sellingPrice)
      const accumNum = unitPrice * cancelNum
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
  const supplierNames = Array.from(new Set(detail.products.map((p) => p.supplierName).filter(Boolean)))
  const hasMultipleSuppliers = supplierNames.length > 1
  /** 공급사별로 파생 주문상태가 서로 다를 때만 요약 행에 `공급사별 상태 상이` 표시 */
  const statusDiffersAcrossSuppliers =
    supplierNames.length > 1 &&
    new Set(
      supplierNames.map((name) =>
        getSupplierOrderStatusFromSap({
          sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
          supplierName: name,
          fallbackOrderStatus: detail.orderStatus,
        })
      )
    ).size > 1
  const statusActionButton =
    status === '주문 완료' ? { label: '결제완료', className: styles.btnShip } :
    status === '결제완료' ? { label: '발송 준비중 처리', className: styles.btnShip } :
    status === '발송 준비중' ? { label: '발송완료 처리', className: styles.btnShip } :
    status === '발송 완료' ? { label: '발송 준비중 처리', className: styles.btnShip } :
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
            {(status === '주문 완료' || status === '결제완료') && (
              <button
                type="button"
                className={styles.btnOrderCancel}
                onClick={() => {
                  if (detail?.orderNo && onOrderCancel) {
                    onOrderCancel(detail.orderNo)
                    onClose()
                  }
                }}
              >
                주문 취소
              </button>
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
                  <li>* [부분취소]는 발송완료전인 상품에 대해서 예치금을 지급할 수 있습니다.</li>
                  <li>* 해당상품의 적립구분, 부분취소사유, 취소 수량을 입력하고 저장 버튼을 눌러주세요.</li>
                  <li>* [낱알반품][판매가조정]은 발송완료후의 상품에 대해서 예치금을 지급할 수 있습니다.</li>
                  <li>* 단, 적립금액은 취소가능수량 * 주문단가를 초과할 수 없습니다.</li>
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
                        <td className={styles.partialCancelAccumCell}>
                          {(parsePrice(p.sellingPrice) * (parseInt(partialCancelInputs[index]?.cancelQty || '0', 10) || 0)).toLocaleString()}원
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
                  <th>주문일시</th>
                  <td>{detail.orderDateTime}</td>
                  <th>주문아이디/이메일</th>
                  <td>{detail.orderIdEmail}</td>
                </tr>
                <tr>
                  <th>주문상태</th>
                  <td>
                    {statusDiffersAcrossSuppliers
                      ? '공급사별 상태 상이'
                      : `${detail.orderStatus} (${detail.orderStatusDate})`}
                  </td>
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

            {(() => {
              const sapSuppliers = SAP_TARGET_SUPPLIER_NAMES.filter((sapName) =>
                detail.products.some(
                  (p) => normalizeSupplierForSap(p.supplierName) === sapName
                )
              )
              const bySupplier = detail.sapOrderNoBySupplier
              const singleFallback = sapSuppliers.length === 1 ? detail.sapOrderNo : undefined
              const hasSap = sapSuppliers.length > 0
              if (!hasSap) return null
              return (
                <div className={styles.sapOrderSection}>
                  <div className={styles.sectionTitleBar}>
                    <span className={styles.sectionTitle}>SAP 주문 정보</span>
                  </div>
                  <div className={styles.sectionBody}>
                    <table className={`${styles.sapOrderNoInnerTable} ${styles.sapOrderNoEqualCols}`}>
                      <colgroup>
                        {sapSuppliers.map((_, i) => (
                          <col key={i} style={{ width: `${100 / sapSuppliers.length}%` }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          {sapSuppliers.map((name) => (
                            <th key={name} className={styles.sapOrderNoThCompany}>
                              <div>{name}</div>
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {sapSuppliers.map((name) => (
                            <th key={`${name}-fields`} className={styles.sapOrderNoThFieldLabels}>
                              오더번호 / 납품번호 / 빌링번호
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {sapSuppliers.map((name) => {
                            const raw = bySupplier?.[name] ?? singleFallback ?? ''
                            if (!raw || !raw.trim()) return <td key={name} className={styles.sapOrderNoTd}>-</td>
                            const badgeType = detail.sapShipmentTypeBySupplier?.[name]
                            const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                            /** 출하구분: 공장 → 제약, 지역 → 지역 (UI 라벨) */
                            const shipmentLabel =
                              badgeType === '공장' ? '제약' : badgeType === '지역' ? '지역' : null
                            return (
                              <td key={name} className={styles.sapOrderNoTd}>
                                {lines.map((line, i) => {
                                  const parsed = parseSapOrderNo(line)
                                  const hasData = parsed.order !== '-' || parsed.delivery !== '-' || parsed.billing !== '-'
                                  const category =
                                    parseSapCategoryFromLine(line) ?? detail.sapCategoryBySupplier?.[name] ?? null
                                  return hasData ? (
                                    <div key={i} className={styles.sapOrderBlock}>
                                      <div className={styles.sapOrderBlockNumbers}>
                                        {parsed.order} / {parsed.delivery} / {parsed.billing}
                                      </div>
                                      {(category != null || shipmentLabel != null) && (
                                        <div className={styles.sapOrderBlockOtcRow}>
                                          {category != null && (
                                            <span className={styles.sapOrderNoCategory}>{category}</span>
                                          )}
                                          {category != null && shipmentLabel != null && (
                                            <span className={styles.sapOrderNoCellSep}>|</span>
                                          )}
                                          {shipmentLabel != null && (
                                            <span
                                              className={
                                                badgeType === '지역'
                                                  ? styles.shipmentPillRegion
                                                  : styles.shipmentPillFactory
                                              }
                                            >
                                              {shipmentLabel}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div key={i} className={styles.sapOrderNoLine}>{line}</div>
                                  )
                                })}
                                {lines.length === 0 && '-'}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
              const supplierOrderStatus = getSupplierOrderStatusFromSap({
                sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
                supplierName,
                fallbackOrderStatus: detail.orderStatus,
              })
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
                      <table className={`${styles.detailTable} ${styles.detailTableCenter}`}>
                        <thead>
                          <tr>
                            {hasMultipleSuppliers && <th>주문상태</th>}
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
                          {[...products]
                            .sort((a, b) => {
                              const resolved = (p: (typeof products)[0]) =>
                                p.shipmentType || getShipmentTypeFromProductText(p.productSpec)
                              const order: Record<string, number> = { '제약공장 출하': 0, '지역공장 출하': 1 }
                              const ai = order[resolved(a)] ?? 2
                              const bi = order[resolved(b)] ?? 2
                              return ai - bi
                            })
                            .map((p, i) => {
                              const resolvedType = p.shipmentType ?? getShipmentTypeFromProductText(p.productSpec)
                              const isFactory = resolvedType === '제약공장 출하'
                              const isRegion = resolvedType === '지역공장 출하'
                              const badgeLabel = isFactory ? '공장' : isRegion ? '지역' : null
                              return (
                              <tr key={`${supplierName}-${i}`}>
                                {hasMultipleSuppliers && <td>{supplierOrderStatus}</td>}
                                <td>
                                  <div className={styles.supplierCellInner}>
                                    <span>{supplierName ?? '-'}</span>
                                    {badgeLabel != null && (
                                      <span
                                        className={
                                          isFactory ? styles.shipmentPillFactory : styles.shipmentPillRegion
                                        }
                                      >
                                        {badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                </td>
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
                            )
                            })}
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
              <span className={styles.memoTitleHint}>운영팀과 소통을 위한 메모입니다.</span>
            </div>
            <div className={styles.sectionBody}>
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
              <div className={styles.partialCancelHistoryHeader}>
                <div className={styles.sectionTitleBar}>
                  <span className={styles.sectionTitleIconPartial} aria-hidden />
                  <span className={styles.sectionTitle}>부분취소 내역</span>
                </div>
                <button type="button" className={styles.btnAccumHistory} onClick={() => setShowAccumHistoryModal(true)}>
                  적립내역보기
                </button>
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
                          <td>{r.sellingPrice}{r.sellingPrice && !/원\s*$/.test(String(r.sellingPrice)) ? ' 원' : ''}</td>
                          <td>{r.orderQty}{r.orderQty && !/개\s*$/.test(String(r.orderQty)) ? '개' : ''}</td>
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

          <AccumHistoryModal
            open={showAccumHistoryModal}
            onClose={() => setShowAccumHistoryModal(false)}
            records={partialCancelRecords.map((r) => ({
              id: r.id,
              supplierName: r.supplierName,
              productSpec: r.productSpec,
              cancelReturnQty: r.cancelReturnQty,
              depositAccum: r.depositAccum,
              returnShippingAmount: '0원',
              cardCancelAmount: r.cardCancelAmount,
            }))}
            orderDateTime={detail.orderDateTime}
            registrant={currentUserName}
          />
        </div>
      </div>
    </div>
  )
}
